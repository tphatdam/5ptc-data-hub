import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import {
  DailyStockReportEntity,
  InvestmentRecommendation,
} from "./daily-stock-report.entity";
import { DailyStockReportResponseDto } from "./dto/daily-stock-report-response.dto";
import { QueueService } from "../../queue/queue.service";
import { retryStep } from "../../../utils/retry.utils";
import axios from "axios";
import { formatInTimeZone } from "date-fns-tz";

@Injectable()
export class DailyStockReportService {
  private readonly logger = new Logger(DailyStockReportService.name);

  constructor(
    @InjectRepository(DailyStockReportEntity)
    private dailyStockReportRepository: Repository<DailyStockReportEntity>,
    private queueService: QueueService,
  ) {}

  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString();
  }

  private getTodayDateVietnam(): string {
    return formatInTimeZone(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
  }

  async getStockReport(
    stock: string,
    email: string,
  ): Promise<{ url?: string; message?: string }> {
    const today = new Date();
    const todayDateString = today.toISOString().split("T")[0];
    const todayMidnight = new Date(`${todayDateString}T00:00:00.000Z`);
    const normalizedStock = stock.toUpperCase();

    this.logger.log(
      `[DailyStockReportService] Getting stock report - Stock: ${normalizedStock}, Email: ${email}, Date: ${todayDateString}`,
    );

    const dbQueryStart = Date.now();
    const existingReport = await this.dailyStockReportRepository.findOne({
      where: {
        stock: normalizedStock,
        reportDate: MoreThanOrEqual(todayMidnight),
      },
    });
    const dbQueryDuration = Date.now() - dbQueryStart;

    this.logger.log(
      `[DailyStockReportService] Database query completed in ${dbQueryDuration}ms - Found existing report: ${!!existingReport}`,
    );

    const hasValidUrl =
      existingReport &&
      existingReport.url &&
      existingReport.url.trim().length > 0;

    if (hasValidUrl) {
      // Prefer pdfUrl for backwards compatibility with old records, fallback to url for new records
      const pdfUrl = existingReport.pdfUrl || existingReport.url;

      // Double-check the URL is actually valid before returning
      if (!pdfUrl || pdfUrl.trim().length === 0) {
        this.logger.error(
          `[DailyStockReportService] ERROR: Report has null or empty URL despite hasValidUrl check - Stock: ${normalizedStock}, ID: ${existingReport.id}`,
        );
        throw new Error(
          `Cached report for ${normalizedStock} has invalid PDF URL`,
        );
      }

      this.logger.log(
        `[DailyStockReportService] Returning cached report - Stock: ${normalizedStock}, PDF URL: ${pdfUrl}, Created: ${existingReport.createdAt}`,
      );

      // Send email with the cached report
      const templateParams = {
        stock: normalizedStock,
        url: pdfUrl,
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };

      this.logger.log(
        `[DailyStockReportService] Sending email for cached report - Stock: ${normalizedStock}, Email: ${email}, Template ID: 354`,
      );

      this.queueService.addTemplateEmailJob(email, 354, templateParams);

      // Notify external API about cached report access (fire-and-forget with logging)
      // Use void to explicitly mark as fire-and-forget, allowing retryStep to complete
      void (async () => {
        try {
          await this.notifyApiAboutCachedReport(email, normalizedStock, pdfUrl);
        } catch (error: any) {
          // Comprehensive error logging including axios metadata
          let errorDetails = error.message || "Unknown error";
          if (error.response) {
            // Server responded with error status
            errorDetails = `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`;
          } else if (error.request) {
            // Request made but no response (network error, timeout, etc.)
            errorDetails = `Network error - no response received. ${error.message}`;
          }

          this.logger.error(
            `[DailyStockReportService] Failed to notify API about cached report access after all retries - Stock: ${normalizedStock}, Email: ${email}`,
          );
          this.logger.error(
            `[DailyStockReportService] Error details: ${errorDetails}`,
          );
          this.logger.error(
            `[DailyStockReportService] Error stack:`,
            error.stack,
          );
          if (error.config) {
            this.logger.error(`[DailyStockReportService] Request config:`, {
              url: error.config.url,
              method: error.config.method,
              headers: error.config.headers,
            });
          }
          this.logger.error(
            `[DailyStockReportService] Full error object:`,
            error,
          );
        }
      })();

      this.logger.log(
        `[DailyStockReportService] Email job enqueued - Stock: ${normalizedStock}, Email: ${email}`,
      );

      return { url: pdfUrl };
    }

    if (existingReport && !hasValidUrl) {
      this.logger.log(
        `[DailyStockReportService] Report exists but has no valid URL - Stock: ${normalizedStock}, ID: ${existingReport.id}, URL: '${existingReport.url}', Will regenerate report`,
      );
    } else {
      this.logger.log(
        `[DailyStockReportService] No existing report found, enqueueing job - Stock: ${normalizedStock}, Email: ${email}`,
      );
    }

    this.queueService.addGenerateStockReportJob(normalizedStock, email);

    this.logger.log(
      `[DailyStockReportService] Job enqueued (fire-and-forget) - Stock: ${normalizedStock}`,
    );

    return {
      message: "Report is being generated, you'll receive an email soon.",
    };
  }

  private async notifyApiAboutCachedReport(
    email: string,
    stock: string,
    pdfUrl: string,
  ): Promise<void> {
    // Validate AI_STOCK_API_URL is configured
    if (
      !process.env.AI_STOCK_API_URL ||
      process.env.AI_STOCK_API_URL.trim().length === 0
    ) {
      const errorMsg = `AI_STOCK_API_URL environment variable is not configured. Cannot send notification for cached report - Stock: ${stock}, Email: ${email}`;
      this.logger.error(`[DailyStockReportService][API] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    await retryStep(
      async () => {
        const apiUrl = `${process.env.AI_STOCK_API_URL}/api/user-daily-stock-report`;

        const payload = {
          email: email,
          stock: stock,
          url: pdfUrl,
        };

        this.logger.log(
          `[DailyStockReportService][API] Notifying API about cached report access - Stock: ${stock}, Email: ${email}`,
        );

        const response = await axios.post(apiUrl, payload, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        this.logger.log(
          `[DailyStockReportService][API] Cached report notification sent - Stock: ${stock}, Email: ${email}, Status: ${response.status}`,
        );
      },
      5,
      3000,
      `[DailyStockReportService][API] Cached report notification`,
    );
  }

  async saveReport(
    stock: string,
    reportDate: string,
    pdfUrl: string,
    content?: string,
    notificationSent?: boolean,
    investmentRecommendation?: InvestmentRecommendation,
  ): Promise<DailyStockReportEntity> {
    const normalizedStock = stock.toUpperCase();

    // Validate pdfUrl is not null or empty
    if (!pdfUrl || pdfUrl.trim().length === 0) {
      this.logger.error(
        `[DailyStockReportService] FAILED to save report - PDF URL is null or empty for Stock: ${normalizedStock}, Date: ${reportDate}`,
      );
      throw new Error(
        `Cannot save report with null or empty PDF URL for stock ${normalizedStock}`,
      );
    }

    this.logger.log(
      `[DailyStockReportService] Saving report - Stock: ${normalizedStock}, Date: ${reportDate}, PDF URL: ${pdfUrl}, Has content: ${!!content}, Notification sent: ${notificationSent}`,
    );

    const checkStart = Date.now();
    const existingReport = await this.dailyStockReportRepository.findOne({
      where: {
        stock: normalizedStock,
        reportDate: new Date(reportDate),
      },
    });
    const checkDuration = Date.now() - checkStart;

    if (existingReport) {
      this.logger.log(
        `[DailyStockReportService] Report already exists in database (found in ${checkDuration}ms), updating - Stock: ${normalizedStock}, Existing ID: ${existingReport.id}`,
      );
      existingReport.url = pdfUrl; // URL now stores PDF URL
      if (content) {
        existingReport.content = content;
      }
      if (notificationSent !== undefined) {
        existingReport.notificationSent = notificationSent;
      }
      if (investmentRecommendation !== undefined) {
        existingReport.investmentRecommendation = investmentRecommendation;
      }

      const saveStart = Date.now();
      const savedReport =
        await this.dailyStockReportRepository.save(existingReport);
      const saveDuration = Date.now() - saveStart;

      this.logger.log(
        `[DailyStockReportService] Report updated successfully in ${saveDuration}ms - Stock: ${normalizedStock}, ID: ${savedReport.id}`,
      );
      return savedReport;
    }

    this.logger.log(
      `[DailyStockReportService] Creating new report entry (checked in ${checkDuration}ms) - Stock: ${normalizedStock}`,
    );
    const report = this.dailyStockReportRepository.create({
      stock: normalizedStock,
      reportDate: new Date(reportDate),
      url: pdfUrl, // URL now stores PDF URL
      content,
      notificationSent: notificationSent ?? false,
      investmentRecommendation,
    });

    const saveStart = Date.now();
    const savedReport = await this.dailyStockReportRepository.save(report);
    const saveDuration = Date.now() - saveStart;

    this.logger.log(
      `[DailyStockReportService] New report saved successfully in ${saveDuration}ms - Stock: ${normalizedStock}, ID: ${savedReport.id}`,
    );
    return savedReport;
  }

  async atomicClaimNotification(
    stock: string,
    reportDate: string,
  ): Promise<boolean> {
    const normalizedStock = stock.toUpperCase();

    this.logger.log(
      `[DailyStockReportService] Attempting atomic claim for notification - Stock: ${normalizedStock}, Date: ${reportDate}`,
    );

    const result = await this.dailyStockReportRepository
      .createQueryBuilder()
      .update(DailyStockReportEntity)
      .set({ notificationSent: true })
      .where("stock = :stock", { stock: normalizedStock })
      .andWhere("reportDate = :reportDate", {
        reportDate: new Date(reportDate),
      })
      .andWhere("notificationSent = :notificationSent", {
        notificationSent: false,
      })
      .execute();

    const claimed = (result.affected ?? 0) > 0;

    this.logger.log(
      `[DailyStockReportService] Atomic claim result - Stock: ${normalizedStock}, Claimed: ${claimed}, Rows affected: ${result.affected}`,
    );

    return claimed;
  }

  async revertNotificationClaim(
    stock: string,
    reportDate: string,
  ): Promise<void> {
    const normalizedStock = stock.toUpperCase();

    this.logger.log(
      `[DailyStockReportService] Reverting notification claim due to failure - Stock: ${normalizedStock}, Date: ${reportDate}`,
    );

    await this.dailyStockReportRepository
      .createQueryBuilder()
      .update(DailyStockReportEntity)
      .set({ notificationSent: false })
      .where("stock = :stock", { stock: normalizedStock })
      .andWhere("reportDate = :reportDate", {
        reportDate: new Date(reportDate),
      })
      .execute();

    this.logger.log(
      `[DailyStockReportService] Notification claim reverted - Stock: ${normalizedStock}, Date: ${reportDate}`,
    );
  }

  async findByStockAndDate(
    stock: string,
    reportDate: string,
  ): Promise<DailyStockReportEntity | null> {
    const normalizedStock = stock.toUpperCase();
    this.logger.log(
      `[DailyStockReportService] Finding report by stock and date - Stock: ${normalizedStock}, Date: ${reportDate}`,
    );

    const queryStart = Date.now();
    const report = await this.dailyStockReportRepository.findOne({
      where: {
        stock: normalizedStock,
        reportDate: new Date(reportDate),
      },
    });
    const queryDuration = Date.now() - queryStart;

    this.logger.log(
      `[DailyStockReportService] Query completed in ${queryDuration}ms - Stock: ${normalizedStock}, Found: ${!!report}${report ? `, ID: ${report.id}` : ""}`,
    );
    return report;
  }

  async getLatestByStockCode(stockCode: string): Promise<DailyStockReportResponseDto> {
    const normalizedStock = stockCode.trim().toUpperCase();

    if (!normalizedStock) {
      throw new NotFoundException(`Stock code cannot be empty`);
    }

    this.logger.log(
      `[DailyStockReportService] Getting latest report by stock code - Stock: ${normalizedStock}`,
    );

    const queryStart = Date.now();
    const report = await this.dailyStockReportRepository.findOne({
      where: {
        stock: normalizedStock,
      },
      order: {
        reportDate: "DESC",
        createdAt: "DESC",
      },
      select: ["stock", "reportDate", "url", "pdfUrl", "investmentRecommendation"],
    });
    const queryDuration = Date.now() - queryStart;

    if (!report) {
      this.logger.log(
        `[DailyStockReportService] No report found for stock - Stock: ${normalizedStock}, Duration: ${queryDuration}ms`,
      );
      throw new NotFoundException(`No report found for stock code: ${normalizedStock}`);
    }

    this.logger.log(
      `[DailyStockReportService] Latest report found in ${queryDuration}ms - Stock: ${normalizedStock}, Date: ${report.reportDate}`,
    );

    const pdfUrl = report.pdfUrl || report.url || null;
    const reportDateStr = report.reportDate instanceof Date
      ? report.reportDate.toISOString().split("T")[0]
      : String(report.reportDate);

    return {
      stockCode: report.stock,
      reportDate: reportDateStr,
      pdfUrl: pdfUrl,
      investmentRecommendation: report.investmentRecommendation || null,
    };
  }

  async getOrCreateToday(stockCode: string): Promise<DailyStockReportResponseDto> {
    const normalizedStock = stockCode.trim().toUpperCase();

    if (!normalizedStock) {
      throw new NotFoundException(`Stock code cannot be empty`);
    }

    const todayDateString = this.getTodayDateVietnam();

    this.logger.log(
      `[DailyStockReportService] getOrCreateToday - Stock: ${normalizedStock}, Date: ${todayDateString} (Asia/Ho_Chi_Minh)`,
    );

    const queryStart = Date.now();
    const existingReport = await this.dailyStockReportRepository
      .createQueryBuilder("report")
      .where("report.stock = :stock", { stock: normalizedStock })
      .andWhere("report.reportDate = :reportDate", { reportDate: todayDateString })
      .select([
        "report.id",
        "report.stock",
        "report.reportDate",
        "report.url",
        "report.pdfUrl",
        "report.investmentRecommendation",
      ])
      .getOne();
    const queryDuration = Date.now() - queryStart;

    if (existingReport) {
      const pdfUrl = existingReport.pdfUrl || existingReport.url || null;
      const isReady = pdfUrl && pdfUrl.trim().length > 0;

      this.logger.log(
        `[DailyStockReportService] Found existing report for today in ${queryDuration}ms - Stock: ${normalizedStock}, ID: ${existingReport.id}, Status: ${isReady ? "READY" : "PENDING"}`,
      );

      return {
        stockCode: existingReport.stock,
        reportDate: todayDateString,
        pdfUrl: pdfUrl,
        investmentRecommendation: existingReport.investmentRecommendation || null,
        status: isReady ? "READY" : "PENDING",
      };
    }

    this.logger.log(
      `[DailyStockReportService] No report found for today (checked in ${queryDuration}ms) - creating placeholder and enqueueing job - Stock: ${normalizedStock}`,
    );

    const createStart = Date.now();
    const placeholder = this.dailyStockReportRepository.create({
      stock: normalizedStock,
      url: null,
      notificationSent: false,
      reportDate: new Date(todayDateString),
    });

    await this.dailyStockReportRepository.save(placeholder);
    const createDuration = Date.now() - createStart;

    this.logger.log(
      `[DailyStockReportService] Placeholder created in ${createDuration}ms - Stock: ${normalizedStock}, ID: ${placeholder.id}`,
    );

    this.queueService.addGenerateStockReportJob(normalizedStock);

    this.logger.log(
      `[DailyStockReportService] Job enqueued for report generation - Stock: ${normalizedStock}, Date: ${todayDateString}`,
    );

    return {
      stockCode: normalizedStock,
      reportDate: todayDateString,
      pdfUrl: null,
      investmentRecommendation: null,
      status: "PENDING",
    };
  }
}
