import { Logger } from '@nestjs/common';
import { JobRunService, JobContext } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { JobStatus } from '../enums';

export abstract class BaseJob {
  protected abstract readonly jobName: string;
  protected abstract readonly logger: Logger;

  constructor(
    protected readonly jobRunService: JobRunService,
    protected readonly advisoryLockService: AdvisoryLockService,
    protected readonly marketHoursService: MarketHoursService,
  ) {}

  protected async runWithLock(
    options: {
      requireTradingHours?: boolean;
      scheduledFor?: Date;
    },
    executor: () => Promise<number>
  ): Promise<void> {
    if (options.requireTradingHours && !this.marketHoursService.isTradingTime()) {
      this.logger.debug(`${this.jobName}: Skipping - not trading hours`);
      return;
    }

    const lockResult = await this.advisoryLockService.withLock(
      this.jobName,
      async () => {
        const context = await this.jobRunService.startJob(this.jobName, options.scheduledFor);
        if (!context) {
          this.logger.debug(`${this.jobName}: Skipped - already running in this instance`);
          await this.jobRunService.recordSkip(this.jobName, 'Already running in this instance');
          return { skipped: true, reason: 'Already running in this instance' };
        }

        try {
          const items = await executor();
          await this.jobRunService.finishJob(context, JobStatus.SUCCESS, items);
          return { skipped: false, items };
        } catch (error) {
          await this.jobRunService.finishJob(
            context,
            JobStatus.FAIL,
            0,
            error.message
          );
          this.logger.error(`${this.jobName} failed: ${error.message}`, error.stack);
          return { skipped: false, error: error.message };
        }
      },
      async () => {
        await this.jobRunService.recordSkip(this.jobName, 'Lock held by another instance');
        return { skipped: true, reason: 'Lock held by another instance' };
      }
    );

    if (!lockResult.executed) {
      this.logger.debug(`${this.jobName}: Skipped - lock not acquired`);
    }
  }
}
