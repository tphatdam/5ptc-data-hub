import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { subDays, subMinutes } from 'date-fns';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { Symbol as SymbolEntity } from '../entities';
import { QueueService } from '../../queue/queue.service';
import {
  createIntradayBucketMeta,
  logPayload,
  toLogError,
} from '../../../common/logging/ingestion-log';
import {
  CompanyIntelForeignJobPayload,
  CompanyIntelInsiderJobPayload,
} from './company-intel.types';

@Injectable()
export class CompanyIntelJob extends BaseJob {
  protected readonly jobName = 'CompanyIntelJob';
  protected readonly logger = new Logger(CompanyIntelJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    @InjectRepository(SymbolEntity)
    private readonly symbolRepository: Repository<SymbolEntity>,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('*/30 * * * 1-5')
  async handleIntradayRefresh(): Promise<void> {
    await this.runWithLock({ requireTradingHours: true }, async () =>
      this.execute('intraday_refresh'),
    );
  }

  @Cron('10 20 * * 1-5', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleNightlyReconciliation(): Promise<void> {
    await this.runWithLock({}, async () => this.execute('nightly_reconciliation'));
  }

  async runNow(
    mode: 'intraday_refresh' | 'nightly_reconciliation',
  ): Promise<{ status: 'triggered' | 'skipped'; reason?: string }> {
    if (mode === 'intraday_refresh' && !this.marketHoursService.isTradingTime()) {
      const reason = 'Not trading hours';
      await this.jobRunService.recordSkip(this.jobName, reason);
      return { status: 'skipped', reason };
    }

    await this.runWithLock({}, async () => this.execute(mode));
    return { status: 'triggered' };
  }

  private async execute(mode: 'intraday_refresh' | 'nightly_reconciliation'): Promise<number> {
    const startedAt = Date.now();
    const now = new Date();
    const from = mode === 'intraday_refresh' ? subMinutes(now, 30) : subDays(now, 7);
    const timezone = this.configService.get<string>('schedule.timezone') || 'Asia/Ho_Chi_Minh';
    const bucketMeta = createIntradayBucketMeta(now, timezone);
    const cycleId = `company-intel:${mode}:${bucketMeta.bucketIso}`;
    const dispatchConcurrency = this.resolveDispatchConcurrency();

    const activeSymbols = await this.symbolRepository.find({
      where: { isActive: true },
    });

    let enqueued = 0;
    let dedupSkipped = 0;
    let failedEnqueue = 0;

    this.logger.log(
      logPayload({
        event: 'company_intel_dispatch_started',
        module: 'data-hub.company-intel-dispatcher',
        jobName: this.jobName,
        cycleId,
        timeBucket: bucketMeta.bucketIso,
        mode,
        symbolCount: activeSymbols.length,
        status: 'started',
      }),
    );

    await this.runWithConcurrency(activeSymbols, dispatchConcurrency, async (symbol) => {
      const basePayload = {
        cycleId,
        timeBucket: bucketMeta.bucketIso,
        symbolId: symbol.id,
        ticker: symbol.ticker,
        from: from.toISOString(),
        to: now.toISOString(),
        attempt: 1,
      };

      const foreignPayload: CompanyIntelForeignJobPayload = {
        ...basePayload,
        jobType: 'foreign',
      };
      const insiderPayload: CompanyIntelInsiderJobPayload = {
        ...basePayload,
        jobType: 'insider',
      };

      try {
        const foreignResult = await this.queueService.addCompanyIntelForeignJob(foreignPayload);
        if (foreignResult.dedup) {
          dedupSkipped += 1;
          this.logger.warn(
            logPayload({
              event: 'company_intel_symbol_dedup_skipped',
              module: 'data-hub.company-intel-dispatcher',
              jobName: this.jobName,
              cycleId,
              timeBucket: bucketMeta.bucketIso,
              queueJobId: foreignResult.queueJobId,
              symbolId: symbol.id,
              ticker: symbol.ticker,
              jobType: 'foreign',
              status: 'dedup',
            }),
          );
        } else {
          enqueued += 1;
          this.logger.log(
            logPayload({
              event: 'company_intel_symbol_enqueued',
              module: 'data-hub.company-intel-dispatcher',
              jobName: this.jobName,
              cycleId,
              timeBucket: bucketMeta.bucketIso,
              queueJobId: foreignResult.queueJobId,
              symbolId: symbol.id,
              ticker: symbol.ticker,
              jobType: 'foreign',
              status: 'enqueued',
            }),
          );
        }

        const insiderResult = await this.queueService.addCompanyIntelInsiderJob(insiderPayload);
        if (insiderResult.dedup) {
          dedupSkipped += 1;
          this.logger.warn(
            logPayload({
              event: 'company_intel_symbol_dedup_skipped',
              module: 'data-hub.company-intel-dispatcher',
              jobName: this.jobName,
              cycleId,
              timeBucket: bucketMeta.bucketIso,
              queueJobId: insiderResult.queueJobId,
              symbolId: symbol.id,
              ticker: symbol.ticker,
              jobType: 'insider',
              status: 'dedup',
            }),
          );
        } else {
          enqueued += 1;
          this.logger.log(
            logPayload({
              event: 'company_intel_symbol_enqueued',
              module: 'data-hub.company-intel-dispatcher',
              jobName: this.jobName,
              cycleId,
              timeBucket: bucketMeta.bucketIso,
              queueJobId: insiderResult.queueJobId,
              symbolId: symbol.id,
              ticker: symbol.ticker,
              jobType: 'insider',
              status: 'enqueued',
            }),
          );
        }
      } catch (error: unknown) {
        failedEnqueue += 1;
        this.logger.error(
          logPayload({
            event: 'company_intel_symbol_enqueue_failed',
            module: 'data-hub.company-intel-dispatcher',
            jobName: this.jobName,
            cycleId,
            timeBucket: bucketMeta.bucketIso,
            symbolId: symbol.id,
            ticker: symbol.ticker,
            status: 'failed',
            error: toLogError(error),
          }),
        );
      }
    });

    this.logger.log(
      logPayload({
        event: 'company_intel_dispatch_completed',
        module: 'data-hub.company-intel-dispatcher',
        jobName: this.jobName,
        cycleId,
        timeBucket: bucketMeta.bucketIso,
        mode,
        durationMs: Date.now() - startedAt,
        symbolCount: activeSymbols.length,
        enqueued,
        dedupSkipped,
        failedEnqueue,
        processed: enqueued,
        status: failedEnqueue > 0 ? 'partial' : 'succeeded',
      }),
    );

    return enqueued;
  }

  private resolveDispatchConcurrency(): number {
    const configured = Number(
      this.configService.get<string>('dataHub.companyIntelDispatchConcurrency') ||
        process.env.DATA_HUB_COMPANY_INTEL_DISPATCH_CONCURRENCY ||
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
