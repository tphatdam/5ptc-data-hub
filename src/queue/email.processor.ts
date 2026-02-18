import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BrevoService } from '../brevo/brevo.service';
import { logPayload, toLogError } from '../common/logging/ingestion-log';
import {
  EMAIL_JOB_SEND,
  EMAIL_JOB_SEND_TEMPLATE,
  EMAIL_QUEUE,
} from './queue.constants';

interface SendEmailJobData {
  to: string;
  subject: string;
  html: string;
}

interface SendTemplateEmailJobData {
  to: string;
  templateId: number;
  params: Record<string, unknown>;
}

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly brevoService: BrevoService) {
    super();
  }

  async process(
    job: Job<SendEmailJobData | SendTemplateEmailJobData>,
  ): Promise<{ success: boolean; recipient: string; templateId?: number }> {
    if (job.name === EMAIL_JOB_SEND) {
      return this.handleSendEmail(job as Job<SendEmailJobData>);
    }
    if (job.name === EMAIL_JOB_SEND_TEMPLATE) {
      return this.handleSendTemplateEmail(job as Job<SendTemplateEmailJobData>);
    }
    throw new Error(`Unsupported email job "${job.name}"`);
  }

  private async handleSendEmail(
    job: Job<SendEmailJobData>,
  ): Promise<{ success: boolean; recipient: string }> {
    const { to, subject, html } = job.data;
    this.logger.log(
      logPayload({
        event: 'email_worker_started',
        module: 'queue.email',
        jobName: job.name,
        queueJobId: String(job.id),
        status: 'started',
      }),
    );

    try {
      await this.brevoService.sendEmail(to, subject, html);
      this.logger.log(
        logPayload({
          event: 'email_worker_completed',
          module: 'queue.email',
          jobName: job.name,
          queueJobId: String(job.id),
          status: 'succeeded',
        }),
      );
      return { success: true, recipient: to };
    } catch (error: unknown) {
      this.logger.error(
        logPayload({
          event: 'email_worker_failed',
          module: 'queue.email',
          jobName: job.name,
          queueJobId: String(job.id),
          status: 'failed',
          error: toLogError(error),
        }),
      );
      throw error;
    }
  }

  private async handleSendTemplateEmail(
    job: Job<SendTemplateEmailJobData>,
  ): Promise<{ success: boolean; recipient: string; templateId: number }> {
    const { to, templateId, params } = job.data;
    this.logger.log(
      logPayload({
        event: 'email_worker_started',
        module: 'queue.email',
        jobName: job.name,
        queueJobId: String(job.id),
        status: 'started',
      }),
    );

    try {
      await this.brevoService.sendEmailWithTemplate(to, templateId, params);
      this.logger.log(
        logPayload({
          event: 'email_worker_completed',
          module: 'queue.email',
          jobName: job.name,
          queueJobId: String(job.id),
          status: 'succeeded',
        }),
      );
      return { success: true, recipient: to, templateId };
    } catch (error: unknown) {
      this.logger.error(
        logPayload({
          event: 'email_worker_failed',
          module: 'queue.email',
          jobName: job.name,
          queueJobId: String(job.id),
          status: 'failed',
          error: toLogError(error),
        }),
      );
      throw error;
    }
  }
}
