import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { subDays } from 'date-fns';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { UpsertService } from '../services/upsert.service';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { Symbol } from '../entities';
import { QueueService } from '../../queue/queue.service';
import { SimplizeService } from '../../providers/simplize/simplize.service';
import {
  mapNewsEventsToArticles,
  mapRelatedToPeers,
  mapReportsToRows,
  mapSubsidiaries,
} from '../../providers/simplize/mappers';
import { createIntradayBucketMeta, logPayload, toLogError } from '../../../common/logging/ingestion-log';

@Injectable()
export class DailyCompanyCompositeJob extends BaseJob {
  protected readonly jobName = 'DailyCompanyCompositeJob';
  protected readonly logger = new Logger(DailyCompanyCompositeJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly upsertService: UpsertService,
    private readonly providerFactory: ProviderFactoryService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly simplizeService: SimplizeService,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('0 18 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    await this.runWithLock({}, async () => this.execute());
  }

  async runNow(): Promise<void> {
    await this.runWithLock({}, async () => this.execute());
  }

  private async execute(): Promise<number> {
    const startedAt = Date.now();
    const now = new Date();
    const timezone = this.configService.get<string>('schedule.timezone') || 'Asia/Ho_Chi_Minh';
    const bucketMeta = createIntradayBucketMeta(now, timezone);
    const cycleId = `daily-company:${bucketMeta.bucketIso}`;
    const source = await this.providerFactory.getDataSourceByCode('SIMPLIZE_API');
    if (!source) {
      throw new Error('Data source SIMPLIZE_API not found');
    }

    const symbols = await this.symbolRepository.find({ where: { isActive: true } });
    const symbolConcurrency = this.resolveSymbolConcurrency();
    const reportTypes = this.configService.get<string[]>('simplize.reportTypes') || [];
    const newsTypeIds = this.configService.get<string[]>('simplize.newsTypeIds') || [];
    const newsSourceMode = this.configService.get<string>('unified.newsSourceMode') || 'daily-company';
    const includeNews = newsSourceMode.toLowerCase() === 'daily-company';
    const foreignInsiderFrom = subDays(now, 7);

    let enqueueSucceeded = 0;
    let enqueueDedup = 0;
    let enqueueFailed = 0;
    let errorsCount = 0;
    const rowsUpsertedByTable = {
      stock_related_peer: 0,
      company_subsidiary: 0,
      company_report: 0,
      news_article: 0,
    };

    this.logger.log(
      logPayload({
        event: 'daily_company_composite_started',
        module: 'data-hub.daily-company-composite',
        jobName: this.jobName,
        cycleId,
        timeBucket: bucketMeta.bucketIso,
        symbolCount: symbols.length,
        reportTypeCount: reportTypes.length,
        newsTypeCount: newsTypeIds.length,
        includeNews,
        status: 'started',
      }),
    );

    await this.runWithConcurrency(symbols, symbolConcurrency, async (symbol) => {
      const basePayload = {
        cycleId,
        timeBucket: bucketMeta.bucketIso,
        symbolId: symbol.id,
        ticker: symbol.ticker,
        from: foreignInsiderFrom.toISOString(),
        to: now.toISOString(),
        attempt: 1,
      };

      try {
        const foreignResult = await this.queueService.addCompanyIntelForeignJob({
          ...basePayload,
          jobType: 'foreign',
        });
        if (foreignResult.dedup) {
          enqueueDedup += 1;
        } else {
          enqueueSucceeded += 1;
        }
      } catch (error: unknown) {
        enqueueFailed += 1;
        errorsCount += 1;
        this.logger.warn(
          logPayload({
            event: 'daily_company_foreign_enqueue_failed',
            module: 'data-hub.daily-company-composite',
            jobName: this.jobName,
            cycleId,
            symbolId: symbol.id,
            ticker: symbol.ticker,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }

      try {
        const insiderResult = await this.queueService.addCompanyIntelInsiderJob({
          ...basePayload,
          jobType: 'insider',
        });
        if (insiderResult.dedup) {
          enqueueDedup += 1;
        } else {
          enqueueSucceeded += 1;
        }
      } catch (error: unknown) {
        enqueueFailed += 1;
        errorsCount += 1;
        this.logger.warn(
          logPayload({
            event: 'daily_company_insider_enqueue_failed',
            module: 'data-hub.daily-company-composite',
            jobName: this.jobName,
            cycleId,
            symbolId: symbol.id,
            ticker: symbol.ticker,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }

      try {
        const relatedPayload = await this.simplizeService.getRelatedCompanies(symbol.ticker);
        const peerRows = mapRelatedToPeers(relatedPayload, String(symbol.id)).map((row) => ({
          symbolId: symbol.id,
          peerTicker: row.peerTicker,
          relationType: row.relationType,
          score: row.score,
          sourceId: source.id,
        }));
        const result = await this.upsertService.upsertStockRelatedPeers(peerRows);
        rowsUpsertedByTable.stock_related_peer += result.processed;
      } catch (error: unknown) {
        errorsCount += 1;
        this.logger.warn(
          logPayload({
            event: 'daily_company_related_failed',
            module: 'data-hub.daily-company-composite',
            jobName: this.jobName,
            cycleId,
            symbolId: symbol.id,
            ticker: symbol.ticker,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }

      try {
        const subsidiariesPayload = await this.simplizeService.getSubCompanies(symbol.ticker);
        const subsidiariesRows = mapSubsidiaries(subsidiariesPayload, String(symbol.id)).map(
          (row) => ({
            parentSymbolId: symbol.id,
            subsidiaryName: row.subsidiaryName,
            ownershipPercent: row.ownershipPercent,
            relationshipType: row.relationshipType,
            sourceId: source.id,
          }),
        );
        const result = await this.upsertService.upsertCompanySubsidiaries(subsidiariesRows);
        rowsUpsertedByTable.company_subsidiary += result.processed;
      } catch (error: unknown) {
        errorsCount += 1;
        this.logger.warn(
          logPayload({
            event: 'daily_company_subsidiary_failed',
            module: 'data-hub.daily-company-composite',
            jobName: this.jobName,
            cycleId,
            symbolId: symbol.id,
            ticker: symbol.ticker,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }

      try {
        const pageSize = 100;
        const reportRows: Array<{
          symbolId: number;
          reportType: string;
          title: string | null;
          publishedAt: Date | null;
          fileUrl: string;
          fileUrlHash: string;
          sourceId: number;
        }> = [];

        for (const reportType of reportTypes) {
          let page = 0;
          let triedPage1Fallback = false;

          for (;;) {
            const payload = await this.simplizeService.getCompanyReports(
              symbol.ticker,
              reportType,
              page,
              pageSize,
            );
            const list = this.extractList(payload);
            if (list.length === 0) {
              if (page === 0 && !triedPage1Fallback) {
                page = 1;
                triedPage1Fallback = true;
                continue;
              }
              break;
            }

            reportRows.push(
              ...mapReportsToRows(payload, String(symbol.id), reportType).map((row) => ({
                symbolId: symbol.id,
                reportType: row.reportType,
                title: row.title,
                publishedAt: row.publishedAt,
                fileUrl: row.fileUrl,
                fileUrlHash: row.fileUrlHash,
                sourceId: source.id,
              })),
            );

            if (list.length < pageSize) {
              break;
            }
            page += 1;
          }
        }

        const result = await this.upsertService.upsertCompanyReports(reportRows);
        rowsUpsertedByTable.company_report += result.processed;
      } catch (error: unknown) {
        errorsCount += 1;
        this.logger.warn(
          logPayload({
            event: 'daily_company_report_failed',
            module: 'data-hub.daily-company-composite',
            jobName: this.jobName,
            cycleId,
            symbolId: symbol.id,
            ticker: symbol.ticker,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }

      if (!includeNews || newsTypeIds.length === 0) {
        return;
      }

      try {
        const pageSize = 100;
        const newsRows: Array<{
          sourceId: number;
          url: string;
          publishedAt?: Date;
          title: string;
          summary?: string;
          subtitle?: string;
          content?: string;
          tickers?: string[];
          tags?: string[];
          providerNewsId?: string;
          langCode?: string;
          sourceLink?: string;
          newsImageUrl?: string;
          sourceCreatedAt?: Date;
          sourceUpdatedAt?: Date;
          fetchedAt: Date;
        }> = [];

        for (const typeId of newsTypeIds) {
          let page = 0;
          let triedPage1Fallback = false;

          for (;;) {
            const payload = await this.simplizeService.getNewsEvents(
              symbol.ticker,
              typeId,
              page,
              pageSize,
            );
            const list = this.extractList(payload);
            if (list.length === 0) {
              if (page === 0 && !triedPage1Fallback) {
                page = 1;
                triedPage1Fallback = true;
                continue;
              }
              break;
            }

            newsRows.push(
              ...mapNewsEventsToArticles(payload, symbol.ticker, now).map((row) => ({
                sourceId: source.id,
                url: row.url,
                publishedAt: row.publishedAt ?? undefined,
                title: row.title,
                summary: row.summary ?? undefined,
                subtitle: row.subtitle ?? undefined,
                content: row.content ?? undefined,
                tickers: row.tickers ?? undefined,
                tags: row.tags ?? undefined,
                providerNewsId: row.providerNewsId ?? undefined,
                langCode: row.languageCode ?? undefined,
                sourceLink: row.sourceLink ?? undefined,
                newsImageUrl: row.imageUrl ?? undefined,
                sourceCreatedAt: row.sourceCreatedAt ?? undefined,
                sourceUpdatedAt: row.sourceUpdatedAt ?? undefined,
                fetchedAt: row.fetchedAt,
              })),
            );

            if (list.length < pageSize) {
              break;
            }
            page += 1;
          }
        }

        const result = await this.upsertService.upsertNewsArticles(newsRows);
        rowsUpsertedByTable.news_article += result.processed;
      } catch (error: unknown) {
        errorsCount += 1;
        this.logger.warn(
          logPayload({
            event: 'daily_company_news_failed',
            module: 'data-hub.daily-company-composite',
            jobName: this.jobName,
            cycleId,
            symbolId: symbol.id,
            ticker: symbol.ticker,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }
    });

    const rowsUpsertedTotal = Object.values(rowsUpsertedByTable).reduce(
      (total, count) => total + count,
      0,
    );

    this.logger.log(
      logPayload({
        event: 'daily_company_composite_completed',
        module: 'data-hub.daily-company-composite',
        jobName: this.jobName,
        cycleId,
        timeBucket: bucketMeta.bucketIso,
        symbolCount: symbols.length,
        processed: rowsUpsertedTotal + enqueueSucceeded,
        enqueueSucceeded,
        enqueueDedup,
        enqueueFailed,
        errorsCount,
        rowsUpsertedByTable,
        durationMs: Date.now() - startedAt,
        status: errorsCount > 0 ? 'partial' : 'succeeded',
      }),
    );

    return rowsUpsertedTotal + enqueueSucceeded;
  }

  private resolveSymbolConcurrency(): number {
    const configured = Number(
      this.configService.get<string>('dataHub.dailyCompanyCompositeConcurrency') ||
        process.env.DATA_HUB_DAILY_COMPANY_COMPOSITE_CONCURRENCY ||
        '5',
    );
    if (!Number.isFinite(configured)) {
      return 5;
    }
    return Math.min(Math.max(Math.trunc(configured), 1), 25);
  }

  private extractList(payload: unknown): any[] {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload;
    }

    const typed = payload as {
      data?: unknown;
      items?: unknown;
    };

    if (Array.isArray(typed.data)) {
      return typed.data;
    }
    if (Array.isArray(typed.items)) {
      return typed.items;
    }
    if (
      typed.data &&
      typeof typed.data === 'object' &&
      Array.isArray((typed.data as { items?: unknown }).items)
    ) {
      return (typed.data as { items: any[] }).items;
    }
    if (
      typed.data &&
      typeof typed.data === 'object' &&
      Array.isArray((typed.data as { data?: unknown }).data)
    ) {
      return (typed.data as { data: any[] }).data;
    }

    return [];
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const runners = Math.min(concurrency, items.length);
    let cursor = 0;

    await Promise.all(
      Array.from({ length: runners }, async () => {
        while (true) {
          const index = cursor;
          cursor += 1;

          if (index >= items.length) {
            return;
          }

          await worker(items[index]);
        }
      }),
    );
  }
}
