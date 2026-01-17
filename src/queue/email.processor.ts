import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { BrevoService } from '../brevo/brevo.service';

interface SendEmailJobData {
  to: string;
  subject: string;
  html: string;
}

interface SendTemplateEmailJobData {
  to: string;
  templateId: number;
  params: Record<string, any>;
}

@Processor('emailQueue')
export class EmailProcessor {
  constructor(private readonly brevoService: BrevoService) {}

  @Process('SendEmail')
  async handleSendEmail(job: Job<SendEmailJobData>) {
    const { to, subject, html } = job.data;

    console.log(`Processing email to ${to} with subject: ${subject}`);

    try {
      await this.brevoService.sendEmail(to, subject, html);
      console.log(`Email sent successfully to ${to}`);
      return { success: true, recipient: to };
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      await job.moveToFailed({ message: error.message }, true);
      throw error;
    }
  }

  @Process('SendTemplateEmail')
  async handleSendTemplateEmail(job: Job<SendTemplateEmailJobData>) {
    const { to, templateId, params } = job.data;

    console.log(`Processing template email (ID: ${templateId}) to ${to}`);

    try {
      await this.brevoService.sendEmailWithTemplate(to, templateId, params);
      console.log(`Template email sent successfully to ${to}`);
      return { success: true, recipient: to, templateId };
    } catch (error) {
      console.error(`Failed to send template email to ${to}:`, error);
      await job.moveToFailed({ message: error.message }, true);
      throw error;
    }
  }
}
