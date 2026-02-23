import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TriggerRun,
  TriggerRunStatus,
  TriggerRunStep,
  TriggerRunStepStatus,
} from '../../infrastructure/entities';
import { TriggerRunStatusDto } from '../dto/trigger-run-status.dto';

@Injectable()
export class TriggerRunService {
  constructor(
    @InjectRepository(TriggerRun)
    private readonly triggerRunRepository: Repository<TriggerRun>,
    @InjectRepository(TriggerRunStep)
    private readonly triggerRunStepRepository: Repository<TriggerRunStep>,
  ) {}

  async createQueuedRun(mode: 'full' = 'full'): Promise<TriggerRun> {
    const now = new Date();
    const run = this.triggerRunRepository.create({
      mode,
      status: TriggerRunStatus.QUEUED,
      acceptedAt: now,
      startedAt: null,
      finishedAt: null,
      summaryJson: null,
      errorText: null,
    });
    return this.triggerRunRepository.save(run);
  }

  async markRunStarted(runId: string): Promise<void> {
    await this.ensureRunExists(runId);
    await this.triggerRunRepository.update(runId, {
      status: TriggerRunStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      errorText: null,
    });
  }

  async markRunCompleted(
    runId: string,
    status: TriggerRunStatus.SUCCESS | TriggerRunStatus.PARTIAL,
    summary: Record<string, any>,
  ): Promise<void> {
    await this.ensureRunExists(runId);
    await this.triggerRunRepository.update(runId, {
      status,
      finishedAt: new Date(),
      summaryJson: summary,
      errorText: null,
    });
  }

  async markRunFailed(
    runId: string,
    errorText: string,
    summary?: Record<string, any>,
  ): Promise<void> {
    await this.ensureRunExists(runId);
    await this.triggerRunRepository.update(runId, {
      status: TriggerRunStatus.FAIL,
      finishedAt: new Date(),
      summaryJson: summary || null,
      errorText,
    });
  }

  async startStep(runId: string, sequence: number, step: string): Promise<TriggerRunStep> {
    const entity = this.triggerRunStepRepository.create({
      runId,
      sequence,
      step,
      status: TriggerRunStepStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      errorText: null,
      metaJson: null,
    });
    return this.triggerRunStepRepository.save(entity);
  }

  async finishStep(
    stepId: string,
    status: TriggerRunStepStatus.SUCCESS | TriggerRunStepStatus.FAIL | TriggerRunStepStatus.SKIP,
    options?: {
      errorText?: string | null;
      meta?: Record<string, any> | null;
    },
  ): Promise<void> {
    await this.triggerRunStepRepository.update(stepId, {
      status,
      finishedAt: new Date(),
      errorText: options?.errorText || null,
      metaJson: options?.meta || null,
    });
  }

  async getStatus(runId: string): Promise<TriggerRunStatusDto> {
    const run = await this.triggerRunRepository.findOne({
      where: { id: runId },
      relations: ['steps'],
    });
    if (!run) {
      throw new NotFoundException(`Trigger run ${runId} not found`);
    }

    const steps = [...(run.steps || [])].sort((a, b) => a.sequence - b.sequence);
    const success = steps.filter((step) => step.status === TriggerRunStepStatus.SUCCESS).length;
    const failed = steps.filter((step) => step.status === TriggerRunStepStatus.FAIL).length;
    const skipped = steps.filter((step) => step.status === TriggerRunStepStatus.SKIP).length;

    return {
      runId: run.id,
      status: run.status,
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      summary: {
        totalSteps: steps.length,
        success,
        failed,
        skipped,
      },
      steps: steps.map((step) => ({
        step: step.step,
        status: step.status,
        startedAt: step.startedAt ? step.startedAt.toISOString() : null,
        finishedAt: step.finishedAt ? step.finishedAt.toISOString() : null,
        error: step.errorText,
      })),
    };
  }

  private async ensureRunExists(runId: string): Promise<void> {
    const run = await this.triggerRunRepository.findOne({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException(`Trigger run ${runId} not found`);
    }
  }
}
