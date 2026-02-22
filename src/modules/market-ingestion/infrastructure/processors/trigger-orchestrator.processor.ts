import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import {
  TRIGGER_ORCHESTRATOR_QUEUE,
  TRIGGER_ORCHESTRATOR_RUN_ALL_JOB,
} from '../../../queue/queue.constants';
import { TriggerRunAllJobPayload } from '../../../queue/types';
import { TriggerRunService } from '../../application/services/trigger-run.service';
import { TriggerRunStatus, TriggerRunStepStatus } from '../../../../db/entities';
import {
  CompanyIntelJob,
  DailyCompanyCompositeJob,
  EodDailyJob,
  FundamentalsJob,
  GapFillJob,
  GoldJob,
  IntradayMarketJob,
  LegacyBackfillJob,
  NewsJob,
  SymbolSyncJob,
} from '../../../data-hub/jobs';
import { LegacyBackfillService } from '../../../data-hub/services/legacy-backfill.service';

@Injectable()
@Processor(TRIGGER_ORCHESTRATOR_QUEUE, { concurrency: 1 })
export class TriggerOrchestratorProcessor extends WorkerHost {
  private readonly logger = new Logger(TriggerOrchestratorProcessor.name);

  constructor(
    private readonly triggerRunService: TriggerRunService,
    private readonly configService: ConfigService,
    private readonly symbolSyncJob: SymbolSyncJob,
    private readonly intradayMarketJob: IntradayMarketJob,
    private readonly eodDailyJob: EodDailyJob,
    private readonly fundamentalsJob: FundamentalsJob,
    private readonly newsJob: NewsJob,
    private readonly goldJob: GoldJob,
    private readonly companyIntelJob: CompanyIntelJob,
    private readonly dailyCompanyCompositeJob: DailyCompanyCompositeJob,
    private readonly gapFillJob: GapFillJob,
    private readonly legacyBackfillJob: LegacyBackfillJob,
    private readonly legacyBackfillService: LegacyBackfillService,
  ) {
    super();
  }

  async process(job: Job<TriggerRunAllJobPayload>): Promise<void> {
    if (job.name !== TRIGGER_ORCHESTRATOR_RUN_ALL_JOB) {
      throw new Error(`Unsupported orchestrator job ${job.name}`);
    }
    await this.processRunAll(job.data);
  }

  private async processRunAll(payload: TriggerRunAllJobPayload): Promise<void> {
    const runId = payload.runId;
    let sequence = 1;
    const stepStatuses: TriggerRunStepStatus[] = [];

    await this.triggerRunService.markRunStarted(runId);
    try {
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'symbol-sync', async () => {
          await this.symbolSyncJob.runNow();
          return { status: 'triggered' };
        }),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'intraday-market', () => this.intradayMarketJob.runNow()),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'eod-daily', async () => {
          await this.eodDailyJob.runNow();
          return { status: 'triggered' };
        }),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'fundamentals', async () => {
          await this.fundamentalsJob.runNow();
          return { status: 'triggered' };
        }),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'news', async () => {
          await this.newsJob.runNow();
          return { status: 'triggered' };
        }),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'gold', async () => {
          await this.goldJob.runNow();
          return { status: 'triggered' };
        }),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'company-intel:intraday_refresh', () =>
          this.companyIntelJob.runNow('intraday_refresh'),
        ),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'company-intel:nightly_reconciliation', () =>
          this.companyIntelJob.runNow('nightly_reconciliation'),
        ),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'daily-company-composite', async () => {
          await this.dailyCompanyCompositeJob.runNow();
          return { status: 'triggered' };
        }),
      );
      stepStatuses.push(
        await this.runStep(runId, sequence++, 'gap-fill', async () => {
          await this.gapFillJob.runNow();
          return { status: 'triggered' };
        }),
      );

      stepStatuses.push(
        await this.runStep(runId, sequence++, 'legacy-backfill', async () => {
          await this.legacyBackfillJob.runNow();
          return { status: 'triggered' };
        }),
      );

      const batchSize =
        this.configService.get<number>('unified.backfillBatchSize') ||
        Number(process.env.UNIFIED_BACKFILL_BATCH_SIZE || '500');
      const safeBatchSize = Number.isFinite(batchSize)
        ? Math.max(1, Math.trunc(batchSize))
        : 500;

      for (;;) {
        const status = await this.runStep(runId, sequence++, 'legacy-backfill', async () => {
          const result = await this.legacyBackfillService.runBatch(safeBatchSize);
          if (!result.taskName) {
            return { status: 'skipped', reason: 'No pending backfill tasks' };
          }
          return {
            status: 'triggered',
            meta: {
              taskName: result.taskName,
              processed: result.processed,
              batchSize: safeBatchSize,
            },
          };
        });
        stepStatuses.push(status);

        if (status === TriggerRunStepStatus.SKIP) {
          break;
        }
      }

      const failed = stepStatuses.filter((status) => status === TriggerRunStepStatus.FAIL).length;
      const skipped = stepStatuses.filter((status) => status === TriggerRunStepStatus.SKIP).length;
      const success = stepStatuses.filter((status) => status === TriggerRunStepStatus.SUCCESS).length;

      await this.triggerRunService.markRunCompleted(
        runId,
        failed > 0 ? TriggerRunStatus.PARTIAL : TriggerRunStatus.SUCCESS,
        {
          totalSteps: stepStatuses.length,
          success,
          failed,
          skipped,
        },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown orchestrator failure';
      this.logger.error(`Trigger orchestrator failed for run=${runId}: ${message}`);
      await this.triggerRunService.markRunFailed(runId, message, {
        totalSteps: stepStatuses.length,
      });
      throw error;
    }
  }

  private async runStep(
    runId: string,
    sequence: number,
    stepName: string,
    executor: () => Promise<{ status?: 'triggered' | 'skipped'; reason?: string; meta?: Record<string, any> }>,
  ): Promise<TriggerRunStepStatus> {
    const step = await this.triggerRunService.startStep(runId, sequence, stepName);
    try {
      const result = await executor();
      const status =
        result.status === 'skipped' ? TriggerRunStepStatus.SKIP : TriggerRunStepStatus.SUCCESS;
      await this.triggerRunService.finishStep(step.id, status, {
        errorText: result.reason || null,
        meta: result.meta || null,
      });
      return status;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown step error';
      await this.triggerRunService.finishStep(step.id, TriggerRunStepStatus.FAIL, {
        errorText: message,
      });
      return TriggerRunStepStatus.FAIL;
    }
  }
}
