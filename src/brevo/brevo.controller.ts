import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { BrevoService } from './brevo.service';

class SendEmailDto {
  to: string;
  subject: string;
  htmlContent: string;
}

@Controller('brevo')
export class BrevoController {
  constructor(private readonly brevoService: BrevoService) {}

  @Post('send-email')
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    try {
      const { to, subject, htmlContent } = sendEmailDto;

      if (!to || !subject || !htmlContent) {
        throw new HttpException(
          'Missing required fields: to, subject, htmlContent',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.brevoService.sendEmail(
        to,
        subject,
        htmlContent,
      );

      return {
        statusCode: HttpStatus.OK,
        ...result,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
