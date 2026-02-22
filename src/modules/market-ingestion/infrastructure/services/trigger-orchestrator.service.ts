import { Injectable } from '@nestjs/common';
import { QueueService } from '../../../queue/queue.service';
import {
  TRIGGER_ORCHESTRATOR_RUN_ALL_JOB,
} from '../../../queue/queue.constants';
import { TriggerRunService } from '../../application/services/trigger-run.service';
import { TriggerRunStatusDto } from '../../application/dto/trigger-run-status.dto';

@Injectable()
export class TriggerOrchestratorService {
  constructor(
    private readonly queueService: QueueService,
    private readonly triggerRunService: TriggerRunService,
  ) {}

  async enqueueRunAll(): Promise<{ runId: string; acceptedAt: string; mode: 'full' }> {
    const run = await this.triggerRunService.createQueuedRun('full');
    await this.queueService.addTriggerRunAllJob(
      {
        runId: run.id,
        mode: 'full',
      },
      {
        jobId: `${TRIGGER_ORCHESTRATOR_RUN_ALL_JOB}:${run.id}`,
      },
    );

    return {
      runId: run.id,
      acceptedAt: run.acceptedAt.toISOString(),
      mode: 'full',
    };
  }

  async getRunStatus(runId: string): Promise<TriggerRunStatusDto> {
    return this.triggerRunService.getStatus(runId);
  }
}
