import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { LegacyBackfillService } from '../services/legacy-backfill.service';

@Injectable()
export class LegacyBackfillJob extends BaseJob {
  protected readonly jobName = 'LegacyBackfillJob';
  protected readonly logger = new Logger(LegacyBackfillJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly configService: ConfigService,
    private readonly legacyBackfillService: LegacyBackfillService,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('*/10 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    if (!this.isBackfillEnabled()) {
      return;
    }
    await this.runWithLock({}, async () => this.execute());
  }

  async runNow(): Promise<void> {
    if (!this.isBackfillEnabled()) {
      this.logger.debug('Legacy backfill is disabled by configuration');
      return;
    }
    await this.runWithLock({}, async () => this.execute());
  }

  private async execute(): Promise<number> {
    const batchSize =
      this.configService.get<number>('unified.backfillBatchSize') ||
      Number(process.env.UNIFIED_BACKFILL_BATCH_SIZE || '500');
    const safeBatchSize = Number.isFinite(batchSize) ? Math.max(1, Math.trunc(batchSize)) : 500;

    const result = await this.legacyBackfillService.runBatch(safeBatchSize);
    if (!result.taskName) {
      this.logger.log('Legacy backfill has completed all tasks');
      return 0;
    }

    this.logger.log(
      `Legacy backfill processed task=${result.taskName}, batchSize=${safeBatchSize}, processed=${result.processed}`,
    );
    return result.processed;
  }

  private isBackfillEnabled(): boolean {
    if (this.configService.get<boolean>('unified.backfillEnabled') !== true) {
      return false;
    }

    const mode = (this.configService.get<string>('unified.mode') || 'legacy').toLowerCase();
    if (mode === 'datahub') {
      return false;
    }

    return this.configService.get<boolean>('unified.legacyCompatViewsEnabled') !== true;
  }
}
