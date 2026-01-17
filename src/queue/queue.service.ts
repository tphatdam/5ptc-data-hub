import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('reportQueue') private reportQueue: Queue,
    @InjectQueue('emailQueue') private emailQueue: Queue,
  ) {}

  addGenerateStockReportJob(
    stock: string,
    email?: string,
  ): void {
    this.reportQueue.add(
      'GenerateStockReport',
      { stock, email },
      { attempts: 20, backoff: { type: 'fixed', delay: 180000 }, removeOnComplete: true },
    ).catch((error) => {
      console.error(`[QueueService] Failed to enqueue stock report job - Stock: ${stock}, Email: ${email || 'none'}, Error:`, error.message);
    });
  }

  addEmailJob(
    to: string,
    subject: string,
    html: string,
  ): void {
    this.emailQueue.add(
      'SendEmail',
      { to, subject, html },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    ).catch((error) => {
      console.error(`[QueueService] Failed to enqueue email job - To: ${to}, Error:`, error.message);
    });
  }

  addTemplateEmailJob(
    to: string,
    templateId: number,
    params: Record<string, any>,
  ): void {
    this.emailQueue.add(
      'SendTemplateEmail',
      { to, templateId, params },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    ).catch((error) => {
      console.error(`[QueueService] Failed to enqueue template email job - To: ${to}, TemplateId: ${templateId}, Error:`, error.message);
    });
  }

  addJob(
    queueName: string,
    jobName: string,
    data: any,
    options?: any,
  ): Promise<any> {
    const queue = queueName === 'reportQueue' ? this.reportQueue : this.emailQueue;
    return queue.add(jobName, data, options);
  }
}
