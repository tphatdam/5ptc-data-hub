import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DynamicProviderAdapter } from '../providers/dynamic-provider.adapter';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { UpsertService } from '../services/upsert.service';
import { logPayload, toLogError } from '../../../common/logging/ingestion-log';
import {
  COMPANY_INTEL_FOREIGN_JOB,
  COMPANY_INTEL_INSIDER_JOB,
  COMPANY_INTEL_QUEUE,
} from '../../queue/queue.constants';
import {
  CompanyIntelForeignJobPayload,
  CompanyIntelInsiderJobPayload,
} from './company-intel.types';

interface ProviderAttemptContext {
  providerCode: string;
  attempt: number;
  error?: string;
  valueCount?: number;
}

@Injectable()
@Processor(COMPANY_INTEL_QUEUE, { concurrency: 30 })
export class CompanyIntelProcessor extends WorkerHost {
  private readonly logger = new Logger(CompanyIntelProcessor.name);

  constructor(
    private readonly providerAdapter: DynamicProviderAdapter,
    private readonly providerFactory: ProviderFactoryService,
    private readonly upsertService: UpsertService,
  ) {
    super();
  }

  async process(
    job: Job<CompanyIntelForeignJobPayload | CompanyIntelInsiderJobPayload>,
  ): Promise<number> {
    if (job.name === COMPANY_INTEL_FOREIGN_JOB) {
      return this.processForeignJob(job as Job<CompanyIntelForeignJobPayload>);
    }

    if (job.name === COMPANY_INTEL_INSIDER_JOB) {
      return this.processInsiderJob(job as Job<CompanyIntelInsiderJobPayload>);
    }

    throw new Error(`Unsupported company-intel queue job ${job.name}`);
  }

  private async processForeignJob(job: Job<CompanyIntelForeignJobPayload>): Promise<number> {
    const startedAt = Date.now();
    const payload = job.data;
    const queueJobId = String(job.id);

    this.logger.log(
      logPayload({
        event: 'company_intel_worker_started',
        module: 'data-hub.company-intel-worker',
        jobName: job.name,
        cycleId: payload.cycleId,
        timeBucket: payload.timeBucket,
        queueJobId,
        symbolId: payload.symbolId,
        ticker: payload.ticker,
        attempt: job.attemptsMade + 1,
        jobType: payload.jobType,
        status: 'started',
      }),
    );

    try {
      const from = new Date(payload.from);
      const to = new Date(payload.to);

      this.logger.log(
        logPayload({
          event: 'foreign_fetch_started',
          module: 'data-hub.company-intel-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          status: 'started',
        }),
      );

      const fetch = await this.providerAdapter.invokeCompanyIntel(
        'fetchForeignTradingDaily',
        [payload.ticker, from, to],
        {
          logContext: {
            module: 'data-hub.dynamic-provider',
            jobName: job.name,
            cycleId: payload.cycleId,
            queueJobId,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
          },
          hooks: this.createProviderHooks(job, payload),
        },
      );

      const source = await this.providerFactory.getDataSourceByCode(fetch.providerCode);
      if (!source) {
        throw new Error(`Data source ${fetch.providerCode} not found`);
      }

      this.logger.log(
        logPayload({
          event: 'foreign_fetch_completed',
          module: 'data-hub.company-intel-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          providerCode: fetch.providerCode,
          processed: fetch.value.length,
          durationMs: Date.now() - startedAt,
          status: 'fetched',
        }),
      );

      const records = fetch.value
        .filter((row) => row.ticker === payload.ticker)
        .map((row) => ({
          symbolId: payload.symbolId,
          tradeDate: new Date(row.tradeDate),
          buyVolume: this.toBigintString(row.buyVolume),
          sellVolume: this.toBigintString(row.sellVolume),
          netVolume: this.toBigintString(row.netVolume),
          buyValue: this.toNumericString(row.buyValue),
          sellValue: this.toNumericString(row.sellValue),
          netValue: this.toNumericString(row.netValue),
          foreignRoom: this.toBigintString(row.foreignRoom),
          foreignHoldingRoom: this.toBigintString(row.foreignHoldingRoom),
          currentHoldingRatio: this.toNumericString(row.currentHoldingRatio),
          maxHoldingRatio: this.toNumericString(row.maxHoldingRatio),
          rawPayload: row.rawPayload || null,
          sourceId: source.id,
        }));

      const upsertResult = await this.upsertService.upsertStockForeignTradingDaily(records);
      this.logger.log(
        logPayload({
          event: 'foreign_upsert_completed',
          module: 'data-hub.company-intel-worker',
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
          event: 'company_intel_worker_failed',
          module: 'data-hub.company-intel-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          attempt: job.attemptsMade + 1,
          jobType: payload.jobType,
          durationMs: Date.now() - startedAt,
          status: 'failed',
          error: toLogError(error),
        }),
      );
      throw error;
    }
  }

  private async processInsiderJob(job: Job<CompanyIntelInsiderJobPayload>): Promise<number> {
    const startedAt = Date.now();
    const payload = job.data;
    const queueJobId = String(job.id);

    this.logger.log(
      logPayload({
        event: 'company_intel_worker_started',
        module: 'data-hub.company-intel-worker',
        jobName: job.name,
        cycleId: payload.cycleId,
        timeBucket: payload.timeBucket,
        queueJobId,
        symbolId: payload.symbolId,
        ticker: payload.ticker,
        attempt: job.attemptsMade + 1,
        jobType: payload.jobType,
        status: 'started',
      }),
    );

    try {
      const from = new Date(payload.from);
      const to = new Date(payload.to);

      this.logger.log(
        logPayload({
          event: 'insider_fetch_started',
          module: 'data-hub.company-intel-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          status: 'started',
        }),
      );

      const fetch = await this.providerAdapter.invokeCompanyIntel(
        'fetchInsiderEvents',
        [payload.ticker, from, to],
        {
          logContext: {
            module: 'data-hub.dynamic-provider',
            jobName: job.name,
            cycleId: payload.cycleId,
            queueJobId,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
          },
          hooks: this.createProviderHooks(job, payload),
        },
      );

      const source = await this.providerFactory.getDataSourceByCode(fetch.providerCode);
      if (!source) {
        throw new Error(`Data source ${fetch.providerCode} not found`);
      }

      this.logger.log(
        logPayload({
          event: 'insider_fetch_completed',
          module: 'data-hub.company-intel-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          providerCode: fetch.providerCode,
          processed: fetch.value.length,
          durationMs: Date.now() - startedAt,
          status: 'fetched',
        }),
      );

      const records = fetch.value
        .filter((row) => row.ticker === payload.ticker)
        .map((row) => ({
          symbolId: payload.symbolId,
          announceDate: row.announceDate ? new Date(row.announceDate) : undefined,
          transactionDate: new Date(row.transactionDate),
          insiderName: row.insiderName,
          insiderRole: row.insiderRole,
          relatedPerson: row.relatedPerson,
          actionType: row.actionType,
          dealMethod: row.dealMethod,
          status: row.status,
          quantityRegistered: this.toBigintString(row.quantityRegistered),
          quantityExecuted: this.toBigintString(row.quantityExecuted),
          quantityRemaining: this.toBigintString(row.quantityRemaining),
          priceFrom: this.toNumericString(row.priceFrom),
          priceTo: this.toNumericString(row.priceTo),
          avgPrice: this.toNumericString(row.avgPrice),
          dealValue: this.toNumericString(row.dealValue),
          ownershipBefore: this.toNumericString(row.ownershipBefore),
          ownershipAfter: this.toNumericString(row.ownershipAfter),
          ownershipChange: this.toNumericString(row.ownershipChange),
          sourceEventId: row.sourceEventId,
          sourceUrl: row.sourceUrl,
          rawPayload: row.rawPayload || null,
          sourceId: source.id,
        }));

      const upsertResult = await this.upsertService.upsertStockInsiderEvents(records);
      this.logger.log(
        logPayload({
          event: 'insider_upsert_completed',
          module: 'data-hub.company-intel-worker',
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
          event: 'company_intel_worker_failed',
          module: 'data-hub.company-intel-worker',
          jobName: job.name,
          cycleId: payload.cycleId,
          timeBucket: payload.timeBucket,
          queueJobId,
          symbolId: payload.symbolId,
          ticker: payload.ticker,
          attempt: job.attemptsMade + 1,
          jobType: payload.jobType,
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
    payload: CompanyIntelForeignJobPayload | CompanyIntelInsiderJobPayload,
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
            module: 'data-hub.company-intel-worker',
            jobName: job.name,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            queueJobId,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
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
            module: 'data-hub.company-intel-worker',
            jobName: job.name,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            queueJobId,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
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
            module: 'data-hub.company-intel-worker',
            jobName: job.name,
            cycleId: payload.cycleId,
            timeBucket: payload.timeBucket,
            queueJobId,
            symbolId: payload.symbolId,
            ticker: payload.ticker,
            providerCode: ctx.providerCode,
            attempt: ctx.attempt,
            processed: ctx.valueCount,
            status: 'succeeded',
          }),
        );
      },
    };
  }

  private toBigintString(value: number | undefined): string | undefined {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return undefined;
    }

    return Math.trunc(value).toString();
  }

  private toNumericString(value: number | undefined): string | undefined {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return undefined;
    }

    return String(value);
  }
}
