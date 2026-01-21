import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SymbolsRepository } from '../symbols/symbols.repository';
import { QuoteDailyRepository, BulkUpsertQuoteDailyDto } from '../quotes/quote-daily.repository';
import { QuoteIntradayRepository, BulkUpsertQuoteIntradayDto } from '../quotes/quote-intraday.repository';
import { CrawlRunsRepository } from './crawl-runs.repository';
import { MarketProvider } from '../providers/market-provider.interface';
import { Symbol } from '../db/entities/symbol.entity';

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
    // Get cron expressions and timezone from configuration with defaults
    const intradayCron = this.configService.get<string>('schedule.intradayCron') || '*/15 * * * *';
    const dailyEodCron = this.configService.get<string>('schedule.dailyEodCron') || '5 18 * * *';
    const timezone = this.configService.get<string>('schedule.timezone') || 'Asia/Ho_Chi_Minh';

    this.logger.log(
      `Initializing scheduled jobs with cron expressions: intraday="${intradayCron}", dailyEod="${dailyEodCron}", timezone="${timezone}"`,
    );

    // Create and register intraday job
    const intradayJob = new CronJob(
      intradayCron,
      () => {
        this.runIntraday15m().catch((error) => {
          this.logger.error('Unhandled error in intraday job', error);
        });
      },
      null,
      true,
      timezone,
    );

    // Create and register daily EOD job
    const dailyEodJob = new CronJob(
      dailyEodCron,
      () => {
        this.runDailyEOD().catch((error) => {
          this.logger.error('Unhandled error in daily EOD job', error);
        });
      },
      null,
      true,
      timezone,
    );

    // Register jobs with scheduler registry
    this.schedulerRegistry.addCronJob('intraday-15m', intradayJob);
    this.schedulerRegistry.addCronJob('daily-eod', dailyEodJob);

    this.logger.log('Scheduled jobs registered successfully');
  }

  /**
   * Scheduled job that runs to fetch intraday data.
   * Schedule is configured via INTRADAY_CRON environment variable (default: every 15 minutes).
   */
  async runIntraday15m(): Promise<void> {
    this.logger.log('Starting intraday-15m job');

    await this.executeIngestionJob('intraday-15m', async (symbols) => {
      const allTicks: BulkUpsertQuoteIntradayDto[] = [];

      // Fetch intraday data for each symbol
      for (const symbol of symbols) {
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

          this.logger.debug(
            `Fetched ${ticks.length} intraday ticks for symbol ${symbol.symbol}`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed to fetch intraday data for symbol ${symbol.symbol}: ${errorMessage}`,
          );
          // Continue with other symbols even if one fails
        }
      }

      // Bulk upsert all collected ticks
      const rowsUpserted = await this.quoteIntradayRepo.bulkUpsert(allTicks);

      return { rowsUpserted };
    });
  }

  /**
   * Scheduled job that runs to fetch end-of-day data.
   * Schedule is configured via DAILY_EOD_CRON environment variable (default: 18:05 daily).
   * Timezone is configured via SCHEDULE_TIMEZONE environment variable (default: Asia/Ho_Chi_Minh).
   */
  async runDailyEOD(): Promise<void> {
    this.logger.log('Starting daily-eod job');

    await this.executeIngestionJob('daily-eod', async (symbols) => {
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
    fetchAndStore: (symbols: Symbol[]) => Promise<{ rowsUpserted: number }>,
  ): Promise<void> {
    const startTime = Date.now();

    // Create crawl run record with status RUNNING
    const crawlRun = await this.crawlRunsRepo.createRun({
      jobName,
      source: this.provider.name,
    });

    this.logger.log(
      `Created crawl run ${crawlRun.id} for job ${jobName} from source ${this.provider.name}`,
    );

    try {
      // Load symbols from database
      let symbols = await this.symbolsRepo.getAllActive();

      // If no symbols found, fetch from provider and seed database
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

      // Fetch and store data using the provided function
      const { rowsUpserted } = await fetchAndStore(symbols);

      // Calculate statistics
      const durationMs = Date.now() - startTime;
      const stats = {
        symbolsCount: symbols.length,
        rowsUpserted,
        durationMs,
      };

      // Mark crawl run as successful
      await this.crawlRunsRepo.markSuccess(crawlRun.id, stats);

      this.logger.log(
        `Job ${jobName} completed successfully: ${rowsUpserted} rows upserted for ${symbols.length} symbols in ${durationMs}ms`,
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Mark crawl run as failed with error text and partial stats
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
}
