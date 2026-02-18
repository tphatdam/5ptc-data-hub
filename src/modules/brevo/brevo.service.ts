import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from 'sib-api-v3-sdk';

@Injectable()
export class BrevoService {
  private apiInstance: any;
  private defaultSenderEmail: string;
  private defaultSenderName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');

    if (!apiKey) {
      throw new Error('BREVO_API_KEY is not configured');
    }

    this.defaultSenderEmail = this.configService.get<string>('BREVO_SENDER_EMAIL') || 'noreply@example.com';
    this.defaultSenderName = this.configService.get<string>('BREVO_SENDER_NAME') || 'Notification System';

    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKeyAuth = defaultClient.authentications['api-key'];
    apiKeyAuth.apiKey = apiKey;

    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    senderEmail?: string,
    senderName?: string,
  ): Promise<any> {
    try {
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      sendSmtpEmail.sender = {
        name: senderName || this.defaultSenderName,
        email: senderEmail || this.defaultSenderEmail,
      };

      sendSmtpEmail.to = [{ email: to }];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      return {
        success: true,
        messageId: result.messageId,
        message: 'Email sent successfully',
      };
    } catch (error: any) {
      console.error('Error sending email:', error);
      throw new Error(
        `Failed to send email: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async sendEmailWithTemplate(
    to: string,
    templateId: number,
    params: Record<string, any>,
    senderEmail?: string,
    senderName?: string,
  ): Promise<any> {
    try {
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      sendSmtpEmail.sender = {
        name: senderName || this.defaultSenderName,
        email: senderEmail || this.defaultSenderEmail,
      };

      sendSmtpEmail.to = [{ email: to }];
      sendSmtpEmail.templateId = templateId;
      sendSmtpEmail.params = params;

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      return {
        success: true,
        messageId: result.messageId,
        message: 'Email sent successfully with template',
      };
    } catch (error: any) {
      console.error('Error sending email with template:', error);
      throw new Error(
        `Failed to send email with template: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
