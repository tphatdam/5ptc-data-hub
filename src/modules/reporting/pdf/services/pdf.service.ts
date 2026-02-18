import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.html2pdfrocket.com/pdf';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('HTML2PDFROCKET_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.error('HTML2PDFROCKET_API_KEY is not configured');
      throw new Error('HTML2PDFROCKET_API_KEY environment variable is required');
    }
  }

  async generate(html: string): Promise<Buffer> {
    try {
      this.logger.log('Generating PDF from HTML using HTML2PDFRocket API');

      const formData = new URLSearchParams();
      formData.append('apikey', this.apiKey);
      formData.append('value', html);

      const response = await axios.post(this.apiUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        responseType: 'arraybuffer',
        timeout: 60000,
      });

      this.logger.log('PDF generated successfully');
      return Buffer.from(response.data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError(error: any): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const statusCode = axiosError.response.status;
        const errorMessage = axiosError.response.data?.toString() || 'Unknown error';

        this.logger.error(
          `HTML2PDFRocket API error (${statusCode}): ${errorMessage}`,
        );

        if (statusCode === 401 || statusCode === 403) {
          throw new InternalServerErrorException(
            'Invalid HTML2PDFRocket API key. Please check your API key configuration.',
          );
        }

        if (statusCode === 429) {
          throw new InternalServerErrorException(
            'HTML2PDFRocket API rate limit exceeded. Please try again later.',
          );
        }

        throw new InternalServerErrorException(
          `Failed to generate PDF: API returned status ${statusCode}`,
        );
      }

      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        this.logger.error('HTML2PDFRocket API timeout');
        throw new InternalServerErrorException(
          'PDF generation timed out. The HTML content may be too large or complex.',
        );
      }

      if (axiosError.request) {
        this.logger.error('No response from HTML2PDFRocket API');
        throw new InternalServerErrorException(
          'Failed to connect to HTML2PDFRocket API. Please check your network connection.',
        );
      }
    }

    this.logger.error('Unexpected error during PDF generation', error);
    throw new InternalServerErrorException(
      `Failed to generate PDF: ${error.message || 'Unknown error'}`,
    );
  }
}
