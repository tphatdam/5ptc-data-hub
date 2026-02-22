import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, JobsOptions, Queue } from 'bullmq';
import { IngestionLogMeta, logPayload, toLogError } from '../../common/logging/ingestion-log';
import type {
  CompanyIntelForeignJobPayload,
  CompanyIntelInsiderJobPayload,
  IntradayIndexJobPayload,
  IntradayStockJobPayload,
  TriggerRunAllJobPayload,
} from './types';
import {
  COMPANY_INTEL_FOREIGN_JOB,
  COMPANY_INTEL_INSIDER_JOB,
  COMPANY_INTEL_QUEUE,
  EMAIL_JOB_SEND,
  EMAIL_JOB_SEND_TEMPLATE,
  EMAIL_QUEUE,
  MARKET_INTRADAY_INDEX_JOB,
  MARKET_INTRADAY_QUEUE,
  MARKET_INTRADAY_STOCK_JOB,
  REPORT_JOB_GENERATE_STOCK,
  REPORT_QUEUE,
  SEED_QUEUE,
  TRIGGER_ORCHESTRATOR_QUEUE,
  TRIGGER_ORCHESTRATOR_RUN_ALL_JOB,
} from './queue.constants';

export interface QueueAddResult {
  queueJobId?: string;
  dedup: boolean;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    @InjectQueue(SEED_QUEUE) private readonly seedQueue: Queue,
    @InjectQueue(MARKET_INTRADAY_QUEUE)
    private readonly marketIntradayQueue: Queue,
    @InjectQueue(COMPANY_INTEL_QUEUE)
    private readonly companyIntelQueue: Queue,
    @InjectQueue(TRIGGER_ORCHESTRATOR_QUEUE)
    private readonly triggerOrchestratorQueue: Queue,
  ) {}

  async addGenerateStockReportJob(stock: string, email?: string): Promise<void> {
    await this.addWithLogging(
      this.reportQueue,
      REPORT_JOB_GENERATE_STOCK,
      { stock, email },
      {
        attempts: 20,
        backoff: { type: 'fixed', delay: 180000 },
        removeOnComplete: true,
      },
      {
        module: 'queue',
        jobName: REPORT_JOB_GENERATE_STOCK,
        ticker: stock,
      },
      false,
    );
  }

  async addEmailJob(to: string, subject: string, html: string): Promise<void> {
    await this.addWithLogging(
      this.emailQueue,
      EMAIL_JOB_SEND,
      { to, subject, html },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
      {
        module: 'queue',
        jobName: EMAIL_JOB_SEND,
      },
      false,
    );
  }

  async addTemplateEmailJob(
    to: string,
    templateId: number,
    params: Record<string, unknown>,
  ): Promise<void> {
    await this.addWithLogging(
      this.emailQueue,
      EMAIL_JOB_SEND_TEMPLATE,
      { to, templateId, params },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
      {
        module: 'queue',
        jobName: EMAIL_JOB_SEND_TEMPLATE,
      },
      false,
    );
  }

  async addMarketIntradayStockJob(
    payload: IntradayStockJobPayload,
    options?: JobsOptions,
  ): Promise<QueueAddResult> {
    const jobId =
      options?.jobId || `${MARKET_INTRADAY_STOCK_JOB}:${payload.cycleId}:${payload.ticker}`;
    return this.addWithLogging(
      this.marketIntradayQueue,
      MARKET_INTRADAY_STOCK_JOB,
      payload,
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        ...options,
        jobId,
      },
      {
        module: 'queue',
        jobName: MARKET_INTRADAY_STOCK_JOB,
        cycleId: payload.cycleId,
        timeBucket: payload.timeBucket,
        symbolId: payload.symbolId,
        ticker: payload.ticker,
      },
      true,
    );
  }

  async addMarketIntradayIndexJob(
    payload: IntradayIndexJobPayload,
    options?: JobsOptions,
  ): Promise<QueueAddResult> {
    const jobId =
      options?.jobId || `${MARKET_INTRADAY_INDEX_JOB}:${payload.cycleId}:${payload.indexCode}`;
    return this.addWithLogging(
      this.marketIntradayQueue,
      MARKET_INTRADAY_INDEX_JOB,
      payload,
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        ...options,
        jobId,
      },
      {
        module: 'queue',
        jobName: MARKET_INTRADAY_INDEX_JOB,
        cycleId: payload.cycleId,
        timeBucket: payload.timeBucket,
        indexCode: payload.indexCode,
      },
      true,
    );
  }

  async addCompanyIntelForeignJob(
    payload: CompanyIntelForeignJobPayload,
    options?: JobsOptions,
  ): Promise<QueueAddResult> {
    const jobId =
      options?.jobId || `${COMPANY_INTEL_FOREIGN_JOB}:${payload.cycleId}:${payload.ticker}`;
    return this.addWithLogging(
      this.companyIntelQueue,
      COMPANY_INTEL_FOREIGN_JOB,
      payload,
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        ...options,
        jobId,
      },
      {
        module: 'queue',
        jobName: COMPANY_INTEL_FOREIGN_JOB,
        cycleId: payload.cycleId,
        timeBucket: payload.timeBucket,
        symbolId: payload.symbolId,
        ticker: payload.ticker,
      },
      true,
    );
  }

  async addCompanyIntelInsiderJob(
    payload: CompanyIntelInsiderJobPayload,
    options?: JobsOptions,
  ): Promise<QueueAddResult> {
    const jobId =
      options?.jobId || `${COMPANY_INTEL_INSIDER_JOB}:${payload.cycleId}:${payload.ticker}`;
    return this.addWithLogging(
      this.companyIntelQueue,
      COMPANY_INTEL_INSIDER_JOB,
      payload,
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1500,
        },
        ...options,
        jobId,
      },
      {
        module: 'queue',
        jobName: COMPANY_INTEL_INSIDER_JOB,
        cycleId: payload.cycleId,
        timeBucket: payload.timeBucket,
        symbolId: payload.symbolId,
        ticker: payload.ticker,
      },
      true,
    );
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: unknown,
    options?: JobsOptions,
  ): Promise<Job> {
    const queue = this.resolveQueue(queueName);
    const result = await this.addWithLogging(
      queue,
      jobName,
      data,
      options,
      {
        module: 'queue',
        jobName,
        queueName,
      },
      true,
    );

    if (!result.queueJobId) {
      throw new Error(`Failed to enqueue job ${jobName} to queue ${queueName}`);
    }

    const job = await queue.getJob(result.queueJobId);
    if (!job) {
      throw new Error(`Queue job ${result.queueJobId} not found after enqueue`);
    }
    return job;
  }

  async addTriggerRunAllJob(
    payload: TriggerRunAllJobPayload,
    options?: JobsOptions,
  ): Promise<QueueAddResult> {
    const jobId = options?.jobId || `${TRIGGER_ORCHESTRATOR_RUN_ALL_JOB}:${payload.runId}`;
    return this.addWithLogging(
      this.triggerOrchestratorQueue,
      TRIGGER_ORCHESTRATOR_RUN_ALL_JOB,
      payload,
      {
        removeOnComplete: true,
        attempts: 1,
        ...options,
        jobId,
      },
      {
        module: 'queue',
        jobName: TRIGGER_ORCHESTRATOR_RUN_ALL_JOB,
        queueName: TRIGGER_ORCHESTRATOR_QUEUE,
      },
      true,
    );
  }

  private resolveQueue(queueName: string): Queue {
    switch (queueName) {
      case REPORT_QUEUE:
        return this.reportQueue;
      case EMAIL_QUEUE:
        return this.emailQueue;
      case SEED_QUEUE:
        return this.seedQueue;
      case MARKET_INTRADAY_QUEUE:
        return this.marketIntradayQueue;
      case COMPANY_INTEL_QUEUE:
        return this.companyIntelQueue;
      case TRIGGER_ORCHESTRATOR_QUEUE:
        return this.triggerOrchestratorQueue;
      default:
        throw new Error(`Unsupported queue name: ${queueName}`);
    }
  }

  private async addWithLogging(
    queue: Queue,
    jobName: string,
    data: unknown,
    options: JobsOptions | undefined,
    context: IngestionLogMeta,
    throwOnError: boolean,
  ): Promise<QueueAddResult> {
    const queueJobId = options?.jobId ? String(options.jobId) : undefined;
    const startedAt = Date.now();

    this.logger.log(
      logPayload({
        ...context,
        event: 'queue_add_started',
        queueName: queue.name,
        queueJobId,
        status: 'started',
      }),
    );

    if (queueJobId) {
      const existingJob = await queue.getJob(queueJobId);
      if (existingJob) {
        this.logger.warn(
          logPayload({
            ...context,
            event: 'queue_dedup_hit',
            queueName: queue.name,
            queueJobId: String(existingJob.id),
            status: 'dedup',
          }),
        );
        return { queueJobId: String(existingJob.id), dedup: true };
      }
    }

    try {
      const job = await queue.add(jobName, data, options);
      this.logger.log(
        logPayload({
          ...context,
          event: 'queue_add_succeeded',
          queueName: queue.name,
          queueJobId: String(job.id),
          durationMs: Date.now() - startedAt,
          status: 'succeeded',
        }),
      );
      return { queueJobId: String(job.id), dedup: false };
    } catch (error: unknown) {
      if (queueJobId && this.isDuplicateJobError(error)) {
        const existingJob = await queue.getJob(queueJobId);
        this.logger.warn(
          logPayload({
            ...context,
            event: 'queue_dedup_hit',
            queueName: queue.name,
            queueJobId: existingJob ? String(existingJob.id) : queueJobId,
            durationMs: Date.now() - startedAt,
            status: 'dedup',
          }),
        );
        return {
          queueJobId: existingJob ? String(existingJob.id) : queueJobId,
          dedup: true,
        };
      }

      this.logger.error(
        logPayload({
          ...context,
          event: 'queue_add_failed',
          queueName: queue.name,
          queueJobId,
          durationMs: Date.now() - startedAt,
          status: 'failed',
          error: toLogError(error),
        }),
      );

      if (throwOnError) {
        throw error;
      }

      return { queueJobId, dedup: false };
    }
  }

  private isDuplicateJobError(error: unknown): boolean {
    const message = toLogError(error).toLowerCase();
    return message.includes('already exists') || message.includes('jobid');
  }
}
