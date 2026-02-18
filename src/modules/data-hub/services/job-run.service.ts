import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { JobRun } from '../entities';
import { JobStatus } from '../enums';

export interface JobContext {
  runId: string;
  jobName: string;
  startedAt: Date;
  scheduledFor?: Date;
}

@Injectable()
export class JobRunService {
  private readonly logger = new Logger(JobRunService.name);
  private readonly runningJobs = new Map<string, boolean>();

  constructor(
    @InjectRepository(JobRun)
    private readonly jobRunRepository: Repository<JobRun>,
  ) {}

  isRunning(jobName: string): boolean {
    return this.runningJobs.get(jobName) === true;
  }

  async startJob(jobName: string, scheduledFor?: Date): Promise<JobContext | null> {
    if (this.isRunning(jobName)) {
      this.logger.warn(`Job ${jobName} is already running, skipping...`);
      return null;
    }

    this.runningJobs.set(jobName, true);
    const runId = randomUUID();
    const startedAt = new Date();

    this.logger.log(`[${runId}] Starting job: ${jobName}`);

    return {
      runId,
      jobName,
      startedAt,
      scheduledFor,
    };
  }

  async finishJob(
    context: JobContext,
    status: JobStatus,
    items: number = 0,
    error?: string
  ): Promise<void> {
    const finishedAt = new Date();

    try {
      const jobRun = this.jobRunRepository.create({
        id: context.runId,
        jobName: context.jobName,
        scheduledFor: context.scheduledFor,
        startedAt: context.startedAt,
        finishedAt,
        status,
        items,
        error,
      });

      await this.jobRunRepository.save(jobRun);

      const duration = finishedAt.getTime() - context.startedAt.getTime();
      this.logger.log(
        `[${context.runId}] Job ${context.jobName} finished with status ${status}, ` +
          `items: ${items}, duration: ${duration}ms`
      );
    } catch (err: any) {
      this.logger.error(
        `[${context.runId}] Failed to save job run: ${err.message}`
      );
    } finally {
      this.runningJobs.set(context.jobName, false);
    }
  }

  async recordSkip(jobName: string, reason: string): Promise<void> {
    const runId = randomUUID();
    const now = new Date();

    try {
      const jobRun = this.jobRunRepository.create({
        id: runId,
        jobName,
        startedAt: now,
        finishedAt: now,
        status: JobStatus.SKIP,
        items: 0,
        error: reason,
      });

      await this.jobRunRepository.save(jobRun);
      this.logger.log(`[${runId}] Job ${jobName} skipped: ${reason}`);
    } catch (err: any) {
      this.logger.error(`Failed to record skip for ${jobName}: ${err.message}`);
    }
  }

  async getLastSuccessTime(jobName: string): Promise<Date | null> {
    const result = await this.jobRunRepository.findOne({
      where: { jobName, status: JobStatus.SUCCESS },
      order: { finishedAt: 'DESC' },
    });
    return result?.finishedAt || null;
  }

  async getJobHistory(jobName: string, limit: number = 10): Promise<JobRun[]> {
    return this.jobRunRepository.find({
      where: { jobName },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }
}
