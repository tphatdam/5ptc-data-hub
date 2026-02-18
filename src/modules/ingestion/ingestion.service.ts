import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SymbolsRepository } from '../symbols/symbols.repository';
import { QuoteDailyRepository, BulkUpsertQuoteDailyDto } from '../quotes/quote-daily.repository';
import { QuoteIntradayRepository, BulkUpsertQuoteIntradayDto } from '../quotes/quote-intraday.repository';
import { CrawlRunsRepository } from './crawl-runs.repository';
import { MarketProvider } from '../providers/market-provider.interface';
import { Symbol } from '../../db/entities/symbol.entity';
import { ForeignTradingDailyRepository } from '../company-data/foreign-trading-daily.repository';
import { InsiderTradingEventRepository } from '../company-data/insider-trading-event.repository';
import { StockRelatedPeerRepository } from '../company-data/stock-related-peer.repository';
import { CompanySubsidiaryRepository } from '../company-data/company-subsidiary.repository';
import { NewsArticleRepository } from '../company-data/news-article.repository';
import { CompanyReportRepository } from '../company-data/company-report.repository';
import { SimplizeService } from '../providers/simplize/simplize.service';
import {
  mapForeignTradingToRows,
  mapInsiderTimelineToRows,
  mapLatestQuoteToIntraday,
  mapNewsEventsToArticles,
  mapRelatedToPeers,
  mapReportsToRows,
  mapSubsidiaries,
} from '../providers/simplize/mappers';
import {
  createIntradayBucketMeta,
  logPayload,
  toLogError,
} from '../../common/logging/ingestion-log';

/**
 * IngestionService orchestrates scheduled data collection jobs.
 * It manages the execution flow: create crawl run → load symbols → fetch data → bulk upsert → update stats.
 */
@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly symbolsRepo: SymbolsRepository,
    private readonly quoteDailyRepo: QuoteDailyRepository,
    private readonly quoteIntradayRepo: QuoteIntradayRepository,
    private readonly foreignTradingDailyRepo: ForeignTradingDailyRepository,
    private readonly insiderTradingEventRepo: InsiderTradingEventRepository,
    private readonly stockRelatedPeerRepo: StockRelatedPeerRepository,
    private readonly companySubsidiaryRepo: CompanySubsidiaryRepository,
    private readonly newsArticleRepo: NewsArticleRepository,
    private readonly companyReportRepo: CompanyReportRepository,
    private readonly simplizeService: SimplizeService,
    private readonly crawlRunsRepo: CrawlRunsRepository,
    @Inject('MarketProvider')
    private readonly provider: MarketProvider,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Initialize scheduled jobs with configurable cron expressions from environment variables.
   * This allows operators to customize job schedules without code changes.
   */
  onModuleInit() {
    const quoteHourlyCron =
      this.configService.get<string>('schedule.quoteHourlyCron') || '0 * * * *';
    const dailyCompanyCron =
      this.configService.get<string>('schedule.dailyCompanyCron') || '0 18 * * *';
    const timezone = this.configService.get<string>('schedule.timezone') || 'Asia/Ho_Chi_Minh';

    this.logger.log(
      `Initializing scheduled jobs with cron expressions: quoteHourly="${quoteHourlyCron}", dailyCompany="${dailyCompanyCron}", timezone="${timezone}"`,
    );

    const quoteHourlyJob = new CronJob(
      quoteHourlyCron,
      () => {
        this.runQuoteHourly().catch((error) => {
          this.logger.error('Unhandled error in quote-hourly job', error);
        });
      },
      null,
      true,
      timezone,
    );

    const dailyCompanyJob = new CronJob(
      dailyCompanyCron,
      () => {
        this.runDailyCompany().catch((error) => {
          this.logger.error('Unhandled error in daily-company job', error);
        });
      },
      null,
      true,
      timezone,
    );

    this.schedulerRegistry.addCronJob('quote-hourly', quoteHourlyJob);
    this.schedulerRegistry.addCronJob('daily-company', dailyCompanyJob);

    this.logger.log('Scheduled jobs registered successfully');
  }

  async runQuoteHourly(): Promise<void> {
    this.logger.log('Starting quote-hourly job');

    await this.executeIngestionJob('quote-hourly', 'SIMPLIZE', async (symbols) => {
      const now = new Date();
      const ticks: BulkUpsertQuoteIntradayDto[] = [];
      let symbolsSucceeded = 0;
      let errorsCount = 0;

      for (const symbol of symbols) {
        try {
          const quote = await this.simplizeService.getLatestQuote(symbol.symbol);
          ticks.push(mapLatestQuoteToIntraday(quote, symbol.id, now));
          symbolsSucceeded += 1;
        } catch (error) {
          errorsCount += 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed to fetch latest quote for symbol ${symbol.symbol}: ${errorMessage}`,
          );
        }
      }

      const rowsUpserted = await this.quoteIntradayRepo.bulkUpsert(ticks);

      this.logger.log(
        `quote-hourly processed ${symbols.length} symbols: succeeded=${symbolsSucceeded}, errors=${errorsCount}, rowsUpserted=${rowsUpserted}`,
      );

      return { symbolsSucceeded, errorsCount, rowsUpserted };
    });
  }

  async runDailyCompany(): Promise<void> {
    this.logger.log('Starting daily-company job');

    await this.executeIngestionJob('daily-company', 'SIMPLIZE', async (symbols) => {
      const now = new Date();
      const rowsUpsertedByTable: Record<string, number> = {
        foreign_trading_daily: 0,
        insider_trading_events: 0,
        stock_related_peers: 0,
        company_subsidiaries: 0,
        news_articles: 0,
        company_reports: 0,
      };

      const reportTypes = this.configService.get<string[]>('simplize.reportTypes') || [];
      const newsTypeIds = this.configService.get<string[]>('simplize.newsTypeIds') || [];

      let errorsCount = 0;

      for (const symbol of symbols) {
        try {
          const foreignPayload = await this.simplizeService.getForeignTrading(symbol.symbol);
          const foreignRows = mapForeignTradingToRows(foreignPayload, symbol.id);
          rowsUpsertedByTable.foreign_trading_daily +=
            await this.foreignTradingDailyRepo.bulkUpsert(foreignRows);
        } catch (error) {
          errorsCount += 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed foreign trading for symbol ${symbol.symbol}: ${errorMessage}`,
          );
        }

        try {
          const insiderPayload = await this.simplizeService.getInsiderTimeline(symbol.symbol);
          const insiderRows = mapInsiderTimelineToRows(insiderPayload, symbol.id);
          rowsUpsertedByTable.insider_trading_events +=
            await this.insiderTradingEventRepo.bulkUpsert(insiderRows);
        } catch (error) {
          errorsCount += 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed insider timeline for symbol ${symbol.symbol}: ${errorMessage}`,
          );
        }

        try {
          const relatedPayload = await this.simplizeService.getRelatedCompanies(symbol.symbol);
          const peerRows = mapRelatedToPeers(relatedPayload, symbol.id);
          rowsUpsertedByTable.stock_related_peers +=
            await this.stockRelatedPeerRepo.bulkUpsert(peerRows);
        } catch (error) {
          errorsCount += 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed related peers for symbol ${symbol.symbol}: ${errorMessage}`,
          );
        }

        try {
          const subsidiariesPayload = await this.simplizeService.getSubCompanies(symbol.symbol);
          const subsidiariesRows = mapSubsidiaries(subsidiariesPayload, symbol.id);
          rowsUpsertedByTable.company_subsidiaries +=
            await this.companySubsidiaryRepo.bulkUpsert(subsidiariesRows);
        } catch (error) {
          errorsCount += 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed subsidiaries for symbol ${symbol.symbol}: ${errorMessage}`,
          );
        }

        try {
          const allNewsRows: any[] = [];
          const pageSize = 100;

          for (const typeId of newsTypeIds) {
            let page = 0;
            let triedPage1Fallback = false;

            for (;;) {
              const payload = await this.simplizeService.getNewsEvents(
                symbol.symbol,
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
              allNewsRows.push(...mapNewsEventsToArticles(payload, symbol.symbol, now));
              if (list.length < pageSize) {
                break;
              }
              page += 1;
            }
          }

          rowsUpsertedByTable.news_articles += await this.newsArticleRepo.bulkUpsert(
            allNewsRows as any,
          );
        } catch (error) {
          errorsCount += 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed news events for symbol ${symbol.symbol}: ${errorMessage}`);
        }

        try {
          const allReportRows: any[] = [];
          const pageSize = 100;

          for (const reportType of reportTypes) {
            let page = 0;
            let triedPage1Fallback = false;

            for (;;) {
              const payload = await this.simplizeService.getCompanyReports(
                symbol.symbol,
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
              allReportRows.push(...mapReportsToRows(payload, symbol.id, reportType));
              if (list.length < pageSize) {
                break;
              }
              page += 1;
            }
          }

          rowsUpsertedByTable.company_reports += await this.companyReportRepo.bulkUpsert(
            allReportRows as any,
          );
        } catch (error) {
          errorsCount += 1;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed reports for symbol ${symbol.symbol}: ${errorMessage}`);
        }
      }

      const rowsUpsertedTotal = Object.values(rowsUpsertedByTable).reduce((a, b) => a + b, 0);

      this.logger.log(
        `daily-company processed ${symbols.length} symbols: errors=${errorsCount}, rowsUpsertedTotal=${rowsUpsertedTotal}, byTable=${JSON.stringify(
          rowsUpsertedByTable,
        )}`,
      );

      return { errorsCount, rowsUpsertedByTable, rowsUpserted: rowsUpsertedTotal };
    });
  }

  /**
   * Scheduled job that runs to fetch intraday data.
   * Schedule is configured via INTRADAY_CRON environment variable (default: every 15 minutes).
   */
  async runIntraday15m(): Promise<void> {
    this.logger.log('Starting intraday-15m job');

    await this.executeIngestionJob('intraday-15m', this.provider.name, async (symbols) => {
      const startedAt = Date.now();
      const timezone =
        this.configService.get<string>('schedule.timezone') || 'Asia/Ho_Chi_Minh';
      const bucketMeta = createIntradayBucketMeta(new Date(), timezone);
      const allTicks: BulkUpsertQuoteIntradayDto[] = [];
      let symbolsSucceeded = 0;
      let errorsCount = 0;

      this.logger.log(
        logPayload({
          event: 'intraday_dispatch_started',
          module: 'ingestion.legacy',
          jobName: 'intraday-15m-legacy',
          cycleId: bucketMeta.cycleId,
          timeBucket: bucketMeta.bucketIso,
          status: 'started',
          symbolCount: symbols.length,
          indexCount: 0,
        }),
      );

      // Fetch intraday data for each symbol
      for (const symbol of symbols) {
        this.logger.log(
          logPayload({
            event: 'intraday_symbol_enqueued',
            module: 'ingestion.legacy',
            jobName: 'intraday-15m-legacy',
            cycleId: bucketMeta.cycleId,
            timeBucket: bucketMeta.bucketIso,
            symbolId: symbol.id,
            ticker: symbol.symbol,
            symbol: symbol.symbol,
            status: 'legacy_fetch_started',
          }),
        );
        try {
          const ticks = await this.provider.fetchIntraday({
            symbol: symbol.symbol,
          });

          // Add symbolId and source to each tick
          const ticksWithMetadata = ticks.map((tick) => ({
            symbolId: symbol.id,
            ts: tick.ts,
            price: tick.price,
            volume: tick.volume,
            source: this.provider.name,
          }));

          allTicks.push(...ticksWithMetadata);
          symbolsSucceeded += 1;

          this.logger.debug(
            `Fetched ${ticks.length} intraday ticks for symbol ${symbol.symbol}`,
          );
        } catch (error) {
          errorsCount += 1;
          this.logger.warn(
            logPayload({
              event: 'intraday_symbol_fetch_failed',
              module: 'ingestion.legacy',
              jobName: 'intraday-15m-legacy',
              cycleId: bucketMeta.cycleId,
              timeBucket: bucketMeta.bucketIso,
              symbolId: symbol.id,
              ticker: symbol.symbol,
              symbol: symbol.symbol,
              status: 'failed',
              error: toLogError(error),
            }),
          );
          // Continue with other symbols even if one fails
        }
      }

      // Bulk upsert all collected ticks
      const rowsUpserted = await this.quoteIntradayRepo.bulkUpsert(allTicks);
      this.logger.log(
        logPayload({
          event: 'intraday_dispatch_completed',
          module: 'ingestion.legacy',
          jobName: 'intraday-15m-legacy',
          cycleId: bucketMeta.cycleId,
          timeBucket: bucketMeta.bucketIso,
          status: errorsCount > 0 ? 'partial' : 'succeeded',
          durationMs: Date.now() - startedAt,
          symbolCount: symbols.length,
          indexCount: 0,
          enqueued: symbols.length,
          dedupSkipped: 0,
          failedEnqueue: errorsCount,
          processed: rowsUpserted,
          symbolsSucceeded,
          errorsCount,
        }),
      );

      return { rowsUpserted, symbolsSucceeded, errorsCount };
    });
  }

  /**
   * Scheduled job that runs to fetch end-of-day data.
   * Schedule is configured via DAILY_EOD_CRON environment variable (default: 18:05 daily).
   * Timezone is configured via SCHEDULE_TIMEZONE environment variable (default: Asia/Ho_Chi_Minh).
   */
  async runDailyEOD(): Promise<void> {
    this.logger.log('Starting daily-eod job');

    await this.executeIngestionJob('daily-eod', this.provider.name, async (symbols) => {
      const allBars: BulkUpsertQuoteDailyDto[] = [];
      const today = new Date();

      // Fetch daily data for each symbol
      for (const symbol of symbols) {
        try {
          const bars = await this.provider.fetchQuoteHistory({
            symbol: symbol.symbol,
            startDate: today,
            endDate: today,
          });

          // Add symbolId and source to each bar
          const barsWithMetadata = bars.map((bar) => ({
            symbolId: symbol.id,
            date: bar.date,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            source: this.provider.name,
          }));

          allBars.push(...barsWithMetadata);

          this.logger.debug(
            `Fetched ${bars.length} daily bars for symbol ${symbol.symbol}`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed to fetch daily data for symbol ${symbol.symbol}: ${errorMessage}`,
          );
          // Continue with other symbols even if one fails
        }
      }

      // Bulk upsert all collected bars
      const rowsUpserted = await this.quoteDailyRepo.bulkUpsert(allBars);

      return { rowsUpserted };
    });
  }

  /**
   * Helper method to execute an ingestion job with proper error handling and statistics tracking.
   * Handles the complete flow: create crawl run → load symbols → fetch/store data → update stats.
   *
   * @param jobName - Name of the job (e.g., 'intraday-15m', 'daily-eod')
   * @param fetchAndStore - Function that fetches data from provider and stores it
   */
  private async executeIngestionJob(
    jobName: string,
    source: string,
    fetchAndStore: (symbols: Symbol[]) => Promise<Record<string, any>>,
  ): Promise<void> {
    const startTime = Date.now();

    const crawlRun = await this.crawlRunsRepo.createRun({
      jobName,
      source,
    });

    this.logger.log(
      `Created crawl run ${crawlRun.id} for job ${jobName} from source ${source}`,
    );

    try {
      let symbols = await this.symbolsRepo.getAllActive();

      if (symbols.length === 0) {
        this.logger.warn(
          'No symbols found in database, fetching from provider to seed',
        );

        const symbolDTOs = await this.provider.fetchSymbols();

        this.logger.log(
          `Fetched ${symbolDTOs.length} symbols from provider, upserting to database`,
        );

        // Upsert each symbol
        for (const dto of symbolDTOs) {
          try {
            await this.symbolsRepo.upsertSymbol(dto);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(
              `Failed to upsert symbol ${dto.symbol}: ${errorMessage}`,
            );
            // Continue with other symbols
          }
        }

        // Reload symbols after seeding
        symbols = await this.symbolsRepo.getAllActive();

        this.logger.log(
          `Successfully seeded ${symbols.length} symbols to database`,
        );
      }

      this.logger.log(
        `Loaded ${symbols.length} active symbols for job ${jobName}`,
      );

      const resultStats = await fetchAndStore(symbols);

      const durationMs = Date.now() - startTime;
      const stats = {
        symbolsCount: symbols.length,
        durationMs,
        ...resultStats,
      };

      await this.crawlRunsRepo.markSuccess(crawlRun.id, stats);

      this.logger.log(
        `Job ${jobName} completed successfully for ${symbols.length} symbols in ${durationMs}ms`,
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      await this.crawlRunsRepo.markFailed(crawlRun.id, errorMessage, {
        durationMs,
      });

      this.logger.error(
        `Job ${jobName} failed after ${durationMs}ms: ${errorMessage}`,
        errorStack,
      );

      // Re-throw to ensure the error is visible in logs
      throw error;
    }
  }

  private extractList(payload: any): any[] {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload.data)) {
      return payload.data;
    }
    if (Array.isArray(payload.items)) {
      return payload.items;
    }
    if (payload.data && Array.isArray(payload.data.items)) {
      return payload.data.items;
    }
    if (payload.data && Array.isArray(payload.data.data)) {
      return payload.data.data;
    }
    return [];
  }
}
