import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CandleInterval } from '../enums';
import { DynamicProviderAdapter } from '../providers/dynamic-provider.adapter';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { UpsertService } from '../services/upsert.service';
import {
  logPayload,
  toLogError,
} from '../../common/logging/ingestion-log';
import {
  MARKET_INTRADAY_INDEX_JOB,
  MARKET_INTRADAY_QUEUE,
  MARKET_INTRADAY_STOCK_JOB,
} from '../../queue/queue.constants';
import {
  IntradayIndexJobPayload,
  IntradayStockJobPayload,
} from './intraday-market.types';

interface ProviderAttemptContext {
  providerCode: string;
  attempt: number;
  error?: string;
  valueCount?: number;
}

@Injectable()
@Processor(MARKET_INTRADAY_QUEUE, { concurrency: 40 })
export class IntradayMarketProcessor extends WorkerHost {
  private readonly logger = new Logger(IntradayMarketProcessor.name);

  constructor(
    private readonly providerAdapter: DynamicProviderAdapter,
    private readonly providerFactory: ProviderFactoryService,
    private readonly upsertService: UpsertService,
  ) {
    super();
  }

  async process(
    job: Job<IntradayStockJobPayload | IntradayIndexJobPayload>,
  ): Promise<number> {
    if (job.name === MARKET_INTRADAY_STOCK_JOB) {
      return this.processStockJob(job as Job<IntradayStockJobPayload>);
    }
    if (job.name === MARKET_INTRADAY_INDEX_JOB) {
      return this.processIndexJob(job as Job<IntradayIndexJobPayload>);
    }
    throw new Error(`Unsupported intraday queue job ${job.name}`);
  }

  private async processStockJob(job: Job<IntradayStockJobPayload>): Promise<number> {
    const startedAt = Date.now();
    const payload = job.data;
    const queueJobId = String(job.id);

    this.logger.log(
      logPayload({
        event: 'intraday_worker_started',
        module: 'data-hub.intraday-worker',
        jobName: job.name,
        cycleId: payload.cycleId,
        timeBucket: payload.timeBucket,
        queueJobId,
        symbolId: payload.symbolId,
        ticker: payload.ticker,
        attempt: job.attemptsMade + 1,
        status: 'started',
      }),
    );

    const providerHooks = this.createProviderHooks(
      job,
      payload.cycleId,
      payload.timeBucket,
      payload.symbolId,
      payload.ticker,
      undefined,
    );

    try {
      const from = new Date(payload.from);
      const to = new Date(payload.to);
      const fetch = await this.providerAdapter.invokeMarket(
        'fetchIntradayCandles15m',
        [[payload.ticker], from, to],
        {
          logContext: {
            module: 'data-hub.dynamic-provider',
            jobName: job.name,
            cycleId: payload.cycleId,
            queueJobId,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
          },
          hooks: providerHooks,
        },
      );

      const source = await this.providerFactory.getDataSourceByCode(fetch.providerCode);
      if (!source) {
        throw new Error(`Data source ${fetch.providerCode} not found`);
      }

      const records = fetch.value
        .filter((candle) => candle.ticker === payload.ticker)
        .map((candle) => ({
          symbolId: payload.symbolId,
          interval: CandleInterval.INTRADAY_15M,
          ts: new Date(candle.ts),
          open: String(candle.open),
          high: String(candle.high),
          low: String(candle.low),
          close: String(candle.close),
          volume: String(candle.volume),
          value: candle.value !== undefined ? String(candle.value) : undefined,
          sourceId: source.id,
        }));

      this.logger.log(
        logPayload({
          event: 'intraday_transform_completed',
          module: 'data-hub.intraday-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          providerCode: fetch.providerCode,
          processed: records.length,
          durationMs: Date.now() - startedAt,
          status: 'transformed',
        }),
      );

      if (records.length === 0) {
        this.logger.log(
          logPayload({
            event: 'intraday_upsert_completed',
            module: 'data-hub.intraday-worker',
            jobName: job.name,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            queueJobId,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
            providerCode: fetch.providerCode,
            processed: 0,
            durationMs: Date.now() - startedAt,
            status: 'no_data',
          }),
        );
        return 0;
      }

      const upsertResult = await this.upsertService.upsertStockCandles(records);
      this.logger.log(
        logPayload({
          event: 'intraday_upsert_completed',
          module: 'data-hub.intraday-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          providerCode: fetch.providerCode,
          processed: upsertResult.processed,
          inserted: upsertResult.inserted,
          updated: upsertResult.updated,
          durationMs: Date.now() - startedAt,
          status: 'succeeded',
        }),
      );

      return upsertResult.processed;
    } catch (error: unknown) {
      this.logger.error(
        logPayload({
          event: 'intraday_worker_failed',
          module: 'data-hub.intraday-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          attempt: job.attemptsMade + 1,
          durationMs: Date.now() - startedAt,
          status: 'failed',
          error: toLogError(error),
        }),
      );
      throw error;
    }
  }

  private async processIndexJob(job: Job<IntradayIndexJobPayload>): Promise<number> {
    const startedAt = Date.now();
    const payload = job.data;
    const queueJobId = String(job.id);

    this.logger.log(
      logPayload({
        event: 'intraday_worker_started',
        module: 'data-hub.intraday-worker',
        jobName: job.name,
        cycleId: payload.cycleId,
        timeBucket: payload.timeBucket,
        queueJobId,
        indexCode: payload.indexCode,
        attempt: job.attemptsMade + 1,
        status: 'started',
      }),
    );

    const providerHooks = this.createProviderHooks(
      job,
      payload.cycleId,
      payload.timeBucket,
      undefined,
      undefined,
      payload.indexCode,
    );

    try {
      const from = new Date(payload.from);
      const to = new Date(payload.to);
      const fetch = await this.providerAdapter.invokeMarket(
        'fetchIndexCandles',
        [[payload.indexCode], '15m', from, to],
        {
          logContext: {
            module: 'data-hub.dynamic-provider',
            jobName: job.name,
            cycleId: payload.cycleId,
            queueJobId,
            indexCode: payload.indexCode,
          },
          hooks: providerHooks,
        },
      );

      const source = await this.providerFactory.getDataSourceByCode(fetch.providerCode);
      if (!source) {
        throw new Error(`Data source ${fetch.providerCode} not found`);
      }

      const records = fetch.value
        .filter((candle) => candle.indexCode === payload.indexCode)
        .map((candle) => ({
          indexId: payload.indexId,
          interval: CandleInterval.INTRADAY_15M,
          ts: new Date(candle.ts),
          open: String(candle.open),
          high: String(candle.high),
          low: String(candle.low),
          close: String(candle.close),
          volume: candle.volume !== undefined ? String(candle.volume) : undefined,
          sourceId: source.id,
        }));

      this.logger.log(
        logPayload({
          event: 'intraday_transform_completed',
          module: 'data-hub.intraday-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          indexCode: payload.indexCode,
          providerCode: fetch.providerCode,
          processed: records.length,
          durationMs: Date.now() - startedAt,
          status: 'transformed',
        }),
      );

      if (records.length === 0) {
        this.logger.log(
          logPayload({
            event: 'intraday_upsert_completed',
            module: 'data-hub.intraday-worker',
            jobName: job.name,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            queueJobId,
            indexCode: payload.indexCode,
            providerCode: fetch.providerCode,
            processed: 0,
            durationMs: Date.now() - startedAt,
            status: 'no_data',
          }),
        );
        return 0;
      }

      const upsertResult = await this.upsertService.upsertIndexCandles(records);
      this.logger.log(
        logPayload({
          event: 'intraday_upsert_completed',
          module: 'data-hub.intraday-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          indexCode: payload.indexCode,
          providerCode: fetch.providerCode,
          processed: upsertResult.processed,
          inserted: upsertResult.inserted,
          updated: upsertResult.updated,
          durationMs: Date.now() - startedAt,
          status: 'succeeded',
        }),
      );

      return upsertResult.processed;
    } catch (error: unknown) {
      this.logger.error(
        logPayload({
          event: 'intraday_worker_failed',
          module: 'data-hub.intraday-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          indexCode: payload.indexCode,
          attempt: job.attemptsMade + 1,
          durationMs: Date.now() - startedAt,
          status: 'failed',
          error: toLogError(error),
        }),
      );
      throw error;
    }
  }

  private createProviderHooks(
    job: Job,
    cycleId: string,
    timeBucket: string,
    symbolId?: number,
    ticker?: string,
    indexCode?: string,
  ): {
    onProviderTry: (ctx: ProviderAttemptContext) => void;
    onProviderFail: (ctx: ProviderAttemptContext) => void;
    onProviderSuccess: (ctx: ProviderAttemptContext) => void;
  } {
    const queueJobId = String(job.id);
    return {
      onProviderTry: (ctx) => {
        this.logger.log(
          logPayload({
            event: 'provider_attempt_started',
            module: 'data-hub.intraday-worker',
            jobName: job.name,
            cycleId,
            timeBucket,
            queueJobId,
            symbolId,
            ticker,
            indexCode,
            providerCode: ctx.providerCode,
            attempt: ctx.attempt,
            status: 'started',
          }),
        );
      },
      onProviderFail: (ctx) => {
        this.logger.warn(
          logPayload({
            event: 'provider_attempt_failed',
            module: 'data-hub.intraday-worker',
            jobName: job.name,
            cycleId,
            timeBucket,
            queueJobId,
            symbolId,
            ticker,
            indexCode,
            providerCode: ctx.providerCode,
            attempt: ctx.attempt,
            status: 'failed',
            error: ctx.error,
          }),
        );
      },
      onProviderSuccess: (ctx) => {
        this.logger.log(
          logPayload({
            event: 'provider_attempt_succeeded',
            module: 'data-hub.intraday-worker',
            jobName: job.name,
            cycleId,
            timeBucket,
            queueJobId,
            symbolId,
            ticker,
            indexCode,
            providerCode: ctx.providerCode,
            attempt: ctx.attempt,
            processed: ctx.valueCount,
            status: 'succeeded',
          }),
        );
      },
    };
  }
}
