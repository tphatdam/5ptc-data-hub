import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { subMinutes } from 'date-fns';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { Symbol, MarketIndex } from '../entities';
import {
  createIntradayBucketMeta,
  logPayload,
  toLogError,
} from '../../../common/logging/ingestion-log';
import { QueueService } from '../../queue/queue.service';
import {
  IntradayIndexJobPayload,
  IntradayStockJobPayload,
} from './intraday-market.types';

@Injectable()
export class IntradayMarketJob extends BaseJob {
  protected readonly jobName = 'IntradayMarketJob';
  protected readonly logger = new Logger(IntradayMarketJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(MarketIndex)
    private readonly indexRepository: Repository<MarketIndex>,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('*/15 * * * *')
  async handleCron(): Promise<void> {
    await this.runWithLock({ requireTradingHours: true }, async () => {
      return this.execute();
    });
  }

  private async execute(): Promise<number> {
    const startedAt = Date.now();
    const now = new Date();
    const from = subMinutes(now, 30);
    const timezone =
      this.configService.get<string>('schedule.timezone') || 'Asia/Ho_Chi_Minh';
    const bucketMeta = createIntradayBucketMeta(now, timezone);
    const dispatchConcurrency = this.resolveDispatchConcurrency();

    const activeSymbols = await this.symbolRepository.find({
      where: { isActive: true },
    });
    const indices = await this.indexRepository.find();

    let enqueued = 0;
    let dedupSkipped = 0;
    let failedEnqueue = 0;

    this.logger.log(
      logPayload({
        event: 'intraday_dispatch_started',
        module: 'data-hub.intraday-dispatcher',
        jobName: this.jobName,
        cycleId: bucketMeta.cycleId,
        timeBucket: bucketMeta.bucketIso,
        status: 'started',
        symbolCount: activeSymbols.length,
        indexCount: indices.length,
      }),
    );

    await this.runWithConcurrency(activeSymbols, dispatchConcurrency, async (symbol) => {
      const payload: IntradayStockJobPayload = {
        cycleId: bucketMeta.cycleId,
        timeBucket: bucketMeta.bucketIso,
        symbolId: symbol.id,
        ticker: symbol.ticker,
        from: from.toISOString(),
        to: now.toISOString(),
      };

      try {
        const result = await this.queueService.addMarketIntradayStockJob(payload);
        if (result.dedup) {
          dedupSkipped += 1;
          this.logger.warn(
            logPayload({
              event: 'intraday_symbol_dedup_skipped',
              module: 'data-hub.intraday-dispatcher',
              jobName: this.jobName,
              cycleId: payload.cycleId,
              timeBucket: payload.timeBucket,
              queueJobId: result.queueJobId,
              symbolId: payload.symbolId,
              ticker: payload.ticker,
              status: 'dedup',
            }),
          );
          return;
        }

        enqueued += 1;
        this.logger.log(
          logPayload({
            event: 'intraday_symbol_enqueued',
            module: 'data-hub.intraday-dispatcher',
            jobName: this.jobName,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            queueJobId: result.queueJobId,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
            status: 'enqueued',
          }),
        );
      } catch (error: unknown) {
        failedEnqueue += 1;
        this.logger.error(
          logPayload({
            event: 'intraday_symbol_enqueue_failed',
            module: 'data-hub.intraday-dispatcher',
            jobName: this.jobName,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }
    });

    await this.runWithConcurrency(indices, dispatchConcurrency, async (index) => {
      const payload: IntradayIndexJobPayload = {
        cycleId: bucketMeta.cycleId,
        timeBucket: bucketMeta.bucketIso,
        indexId: index.id,
        indexCode: index.code,
        from: from.toISOString(),
        to: now.toISOString(),
      };

      try {
        const result = await this.queueService.addMarketIntradayIndexJob(payload);
        if (result.dedup) {
          dedupSkipped += 1;
          this.logger.warn(
            logPayload({
              event: 'intraday_index_dedup_skipped',
              module: 'data-hub.intraday-dispatcher',
              jobName: this.jobName,
              cycleId: payload.cycleId,
              timeBucket: payload.timeBucket,
              queueJobId: result.queueJobId,
              indexCode: payload.indexCode,
              status: 'dedup',
            }),
          );
          return;
        }

        enqueued += 1;
        this.logger.log(
          logPayload({
            event: 'intraday_index_enqueued',
            module: 'data-hub.intraday-dispatcher',
            jobName: this.jobName,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            queueJobId: result.queueJobId,
            indexCode: payload.indexCode,
            status: 'enqueued',
          }),
        );
      } catch (error: unknown) {
        failedEnqueue += 1;
        this.logger.error(
          logPayload({
            event: 'intraday_index_enqueue_failed',
            module: 'data-hub.intraday-dispatcher',
            jobName: this.jobName,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            indexCode: payload.indexCode,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }
    });

    this.logger.log(
      logPayload({
        event: 'intraday_dispatch_completed',
        module: 'data-hub.intraday-dispatcher',
        jobName: this.jobName,
        cycleId: bucketMeta.cycleId,
        timeBucket: bucketMeta.bucketIso,
        processed: enqueued,
        durationMs: Date.now() - startedAt,
        status: failedEnqueue > 0 ? 'partial' : 'succeeded',
        symbolCount: activeSymbols.length,
        indexCount: indices.length,
        enqueued,
        dedupSkipped,
        failedEnqueue,
      }),
    );

    return enqueued;
  }

  private resolveDispatchConcurrency(): number {
    const configured = Number(
      this.configService.get<string>('dataHub.intradayDispatchConcurrency') ||
        process.env.DATA_HUB_INTRADAY_DISPATCH_CONCURRENCY ||
        '25',
    );
    if (!Number.isFinite(configured)) {
      return 25;
    }
    return Math.min(Math.max(Math.trunc(configured), 1), 100);
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
