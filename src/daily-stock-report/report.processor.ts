import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { StockReportService } from "../pdf/services/stock-report.service";
import { StockReportHTMLGeneratorService } from "../pdf/services/stock-report-html-generator.service";
import { PdfService } from "../pdf/services/pdf.service";
import { S3Service } from "../common/services/s3.service";
import { DailyStockReportService } from "./daily-stock-report.service";
import { QueueService } from "../queue/queue.service";
import {
  REPORT_JOB_GENERATE_STOCK,
  REPORT_QUEUE,
} from "../queue/queue.constants";
import { retryStep } from "../utils/retry.utils";
import { InvestmentRecommendation } from "./daily-stock-report.entity";
import axios from "axios";

function mapRecommendation(raw: string | undefined): InvestmentRecommendation | undefined {
  if (!raw) return undefined;
  const normalized = raw.toUpperCase();
  switch (normalized) {
    case 'MUA':
      return InvestmentRecommendation.BUY;
    case 'GIỮ':
      return InvestmentRecommendation.HOLD;
    case 'BÁN':
      return InvestmentRecommendation.SELL;
    default:
      return undefined;
  }
}

interface GenerateStockReportJobData {
  stock: string;
  email?: string;
}

@Processor(REPORT_QUEUE, { concurrency: 2 })
export class ReportProcessor extends WorkerHost {
  constructor(
    private readonly stockReportService: StockReportService,
    private readonly htmlGeneratorService: StockReportHTMLGeneratorService,
    private readonly pdfService: PdfService,
    private readonly s3Service: S3Service,
    private readonly dailyStockReportService: DailyStockReportService,
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<GenerateStockReportJobData>) {
    if (job.name !== REPORT_JOB_GENERATE_STOCK) {
      throw new Error(`Unsupported report job "${job.name}"`);
    }

    const { stock, email } = job.data;
    const queueJobId = job.id ?? 'unknown';

    try {
      const result = await this.executeReportGeneration(stock, email, queueJobId);
      strapi.log.info(`✅ Success`);
      return result;
    } catch (err) {
      strapi.log.info(`❌ Fail ${job.attemptsMade + 1}, retry in 3 min`);
      throw err;
    }
  }

  private async executeReportGeneration(
    stock: string,
    email: string | undefined,
    jobId: string | number,
  ) {
    const reportDate = new Date().toISOString().split("T")[0];
    const jobStartTime = Date.now();

    strapi.log.info(
      `[ReportProcessor][Job:${jobId}] ========== STARTING JOB ==========`,
    );
    strapi.log.info(
      `[ReportProcessor][Job:${jobId}] Processing stock report - Stock: ${stock}, Date: ${reportDate}, Email: ${email}`,
    );

    try {
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] Step 1/5: Checking for existing report`,
      );
      const checkStart = Date.now();
      const existingReport =
        await this.dailyStockReportService.findByStockAndDate(
          stock,
          reportDate,
        );
      const checkDuration = Date.now() - checkStart;

      if (existingReport) {
        // Prefer pdfUrl for backwards compatibility with old records, fallback to url for new records
        const pdfUrl = existingReport.pdfUrl || existingReport.url;
        
        // Check if this is a placeholder row (no URL yet) - need to regenerate
        if (!pdfUrl || pdfUrl.trim().length === 0) {
          strapi.log.info(
            `[ReportProcessor][Job:${jobId}] Existing report is a placeholder (no URL) - proceeding with generation`,
          );
        } else {
          strapi.log.info(
            `[ReportProcessor][Job:${jobId}] Existing report found in ${checkDuration}ms - PDF URL: ${pdfUrl}`,
          );
          if (email) {
            strapi.log.info(
              `[ReportProcessor][Job:${jobId}] Sending email for cached report`,
            );
            await this.sendReportEmail(stock, reportDate, pdfUrl, email);
          } else {
            strapi.log.info(
              `[ReportProcessor][Job:${jobId}] No email provided - skipping email notification`,
            );
          }
          const totalDuration = Date.now() - jobStartTime;
          strapi.log.info(
            `[ReportProcessor][Job:${jobId}] ========== JOB COMPLETED (CACHED) in ${totalDuration}ms ==========`,
          );
          return { success: true, url: pdfUrl, cached: true };
        }
      }
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] No existing report found (checked in ${checkDuration}ms), proceeding with generation`,
      );

      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] Step 2/6: Generating AI stock report`,
      );
      const aiStart = Date.now();
      const reportData = await retryStep(
        async () => await this.stockReportService.generateStockReport(stock),
        5,
        3000,
        `[ReportProcessor][Job:${jobId}] AI generation`,
      );
      const aiDuration = Date.now() - aiStart;
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] AI report generated successfully in ${aiDuration}ms - Data size: ${JSON.stringify(reportData).length} bytes`,
      );

      const conclusion = reportData.sections?.find((s: any) => s.id === 'conclusion');
      const rawRecommendation = conclusion?.data?.recommendation;
      const investmentRecommendation = mapRecommendation(rawRecommendation);
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] Extracted recommendation - Raw: ${rawRecommendation}, Mapped: ${investmentRecommendation}`,
      );

      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] Step 3/6: Converting report to HTML`,
      );
      const htmlStart = Date.now();
      const htmlContent = await retryStep(
        async () => this.htmlGeneratorService.generateReportHTML(reportData),
        5,
        3000,
        `[ReportProcessor][Job:${jobId}] HTML generation`,
      );
      const htmlDuration = Date.now() - htmlStart;
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] HTML generated successfully in ${htmlDuration}ms - Size: ${htmlContent.length} bytes`,
      );

      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] Step 4/6: Generating PDF from HTML`,
      );
      const pdfStart = Date.now();
      const pdfBuffer = await retryStep(
        async () => {
          try {
            strapi.log.info(
              `[ReportProcessor][Job:${jobId}] Generating PDF with PDF-Lib`,
            );
            const buffer = await this.pdfService.generate(htmlContent);
            
            strapi.log.info(
              `[ReportProcessor][Job:${jobId}] PDF generated successfully`,
            );
            
            return buffer;
          } catch (error: any) {
            const errorName = error.name || "Error";
            const errorMessage = error.message || "Unknown error";

            console.error(
              `[ReportProcessor][Job:${jobId}] FAILED at Step 4/6 - PDF generation error (${errorName}):`,
              error,
            );
            throw new Error(
              JSON.stringify({
                success: false,
                error: `PDF generation failed: ${errorMessage}`,
                hint: "An unexpected error occurred. Please contact support if this persists.",
              }),
            );
          }
        },
        5,
        3000,
        `[ReportProcessor][Job:${jobId}] PDF generation`,
      );
      const pdfDuration = Date.now() - pdfStart;
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] PDF generated successfully in ${pdfDuration}ms - Size: ${pdfBuffer.length} bytes`,
      );

      const pdfFileName = `${stock.toLowerCase()}_report_${reportDate}.pdf`;
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] Step 5/6: Uploading PDF to S3`,
      );

      const s3Start = Date.now();
      const pdfUrl = await retryStep(
        async () => {
          const url = await this.s3Service.uploadFile(
            pdfBuffer,
            pdfFileName,
            "application/pdf",
          );

          if (!url || url.trim().length === 0) {
            console.error(
              `[ReportProcessor][Job:${jobId}] FAILED at Step 5/6 - S3 upload returned null or empty URL`,
            );
            throw new Error("S3 upload returned null or empty PDF URL");
          }

          strapi.log.info(
            `[ReportProcessor][Job:${jobId}] PDF uploaded to S3 - URL: ${url}`,
          );
          return url;
        },
        5,
        3000,
        `[ReportProcessor][Job:${jobId}] S3 upload`,
      );
      const s3Duration = Date.now() - s3Start;
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] S3 upload completed in ${s3Duration}ms`,
      );

      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] Step 6/6: Saving to database`,
      );
      const dbStart = Date.now();
      await retryStep(
        async () => {
          await this.dailyStockReportService.saveReport(
            stock,
            reportDate,
            pdfUrl,
            JSON.stringify(reportData),
            undefined,
            investmentRecommendation,
          );
        },
        5,
        3000,
        `[ReportProcessor][Job:${jobId}] Database save`,
      );
      const dbDuration = Date.now() - dbStart;
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] Database save successful in ${dbDuration}ms`,
      );

      if (email) {
        strapi.log.info(
          `[ReportProcessor][Job:${jobId}] All steps completed, sending email notification`,
        );
        await this.sendReportEmail(stock, reportDate, pdfUrl, email);
      } else {
        strapi.log.info(
          `[ReportProcessor][Job:${jobId}] All steps completed, no email provided - skipping notification`,
        );
      }

      const totalDuration = Date.now() - jobStartTime;
      strapi.log.info(
        `[ReportProcessor][Job:${jobId}] ========== JOB COMPLETED SUCCESSFULLY in ${totalDuration}ms ==========`,
      );
      return { success: true, url: pdfUrl };
    } catch (error: any) {
      const totalDuration = Date.now() - jobStartTime;
      console.error(
        `[ReportProcessor][Job:${jobId}] ========== JOB FAILED after ${totalDuration}ms ==========`,
      );
      console.error(`[ReportProcessor][Job:${jobId}] Error details:`, error);
      throw error;
    }
  }

  private async sendReportEmail(
    stock: string,
    reportDate: string,
    pdfUrl: string,
    email: string,
  ): Promise<void> {
    strapi.log.info(
      `[ReportProcessor][Email] Preparing to send email - Stock: ${stock}, Recipient: ${email}, PDF URL: ${pdfUrl}`,
    );

    const templateParams = {
      stock: stock,
      url: pdfUrl,
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };

    strapi.log.info(
      `[ReportProcessor][Email] Template parameters prepared - Template ID: 354, Params:`,
      JSON.stringify(templateParams),
    );

    const emailStart = Date.now();
    
    await retryStep(
      async () => await this.notifyApiAboutReport(email, stock, reportDate, pdfUrl),
      5,
      3000,
      `[ReportProcessor][Email] API notification`,
    );
    
    await this.queueService.addTemplateEmailJob(email, 354, templateParams);
    const emailDuration = Date.now() - emailStart;
    strapi.log.info(
      `[ReportProcessor][Email] Email job enqueued successfully in ${emailDuration}ms - Recipient: ${email}, Template: 354`,
    );
  }

  private async notifyApiAboutReport(
    email: string,
    stock: string,
    reportDate: string,
    pdfUrl: string,
  ): Promise<void> {
    // Validate AI_STOCK_API_URL is configured
    if (!process.env.AI_STOCK_API_URL || process.env.AI_STOCK_API_URL.trim().length === 0) {
      const errorMsg = `AI_STOCK_API_URL environment variable is not configured. Cannot send notification for Stock: ${stock}, Email: ${email}`;
      console.error(`[ReportProcessor][API] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Validate pdfUrl is not null, undefined, or empty
    if (!pdfUrl || pdfUrl.trim().length === 0) {
      const errorMsg = `Cannot notify API about report - PDF URL is ${pdfUrl === null ? "null" : pdfUrl === undefined ? "undefined" : "empty"} for Stock: ${stock}, Email: ${email}`;
      console.error(`[ReportProcessor][API] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Atomically claim the notification slot - prevents duplicates across retries
    const claimed = await this.dailyStockReportService.atomicClaimNotification(stock, reportDate);
    
    if (!claimed) {
      strapi.log.info(
        `[ReportProcessor][API] Notification already sent for Stock: ${stock}, Date: ${reportDate} - Skipping duplicate notification`,
      );
      return;
    }

    strapi.log.info(
      `[ReportProcessor][API] Notification claim successful - proceeding with API call for Stock: ${stock}, Date: ${reportDate}`,
    );

    const apiUrl = `${process.env.AI_STOCK_API_URL}/api/user-daily-stock-report`;

    strapi.log.info(
      `[ReportProcessor][API] Starting API notification - Endpoint: ${apiUrl}`,
    );
    strapi.log.info(
      `[ReportProcessor][API] Payload - Email: ${email}, Stock: ${stock}, PDF URL: ${pdfUrl}`,
    );

    try {
      const payload = {
        email: email,
        stock: stock,
        url: pdfUrl,
      };

      const apiStart = Date.now();
      const response = await axios.post(apiUrl, payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      const apiDuration = Date.now() - apiStart;

      strapi.log.info(
        `[ReportProcessor][API] Notification sent successfully in ${apiDuration}ms - Stock: ${stock}, Email: ${email}, Status: ${response.status}, Response:`,
        JSON.stringify(response.data),
      );
    } catch (error: any) {
      // Revert the claim so retries can resend the notification
      console.error(
        `[ReportProcessor][API] API call failed - reverting claim to allow retries - Stock: ${stock}, Email: ${email}, Error:`,
        error.message,
      );
      await this.dailyStockReportService.revertNotificationClaim(stock, reportDate);
      throw error;
    }
  }
}
