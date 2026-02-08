import {
  Controller,
  Post,
  Body,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PdfService } from './services/pdf.service';
import { StockReportService } from './services/stock-report.service';
import { StockReportHTMLGeneratorService } from './services/stock-report-html-generator.service';
import { GeneratePdfDto } from './dto/generate-pdf.dto';
import { GenerateStockReportDto } from './dto/generate-stock-report.dto';
import { generateHTMLFromJSON } from '../utils/file.utils';
import { TIMEOUTS } from '../utils/constants';
import { OpenAIService } from '../ai/services/openai.service';

@ApiTags('PDF Generation')
@Controller()
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly stockReportService: StockReportService,
    private readonly htmlGeneratorService: StockReportHTMLGeneratorService,
    private readonly openAIService: OpenAIService,
  ) {}

  @Post('generate-pdf')
  @ApiOperation({
    summary: 'Generate a PDF from JSON data',
    description:
      'Accepts a JSON object and converts it into a downloadable PDF document with formatted styling',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF file generated successfully',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - report_json is required' })
  @ApiResponse({ status: 408, description: 'Request timeout - PDF generation took longer than 30 seconds' })
  @ApiResponse({ status: 500, description: 'Internal server error - PDF generation failed' })
  async generatePdf(@Body() generatePdfDto: GeneratePdfDto, @Res() res: Response) {
    const timeout = TIMEOUTS.PDF_GENERATION;
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        res.status(408).json({ error: 'PDF generation timed out' });
      }
    }, timeout);

    try {
      const html = generateHTMLFromJSON(generatePdfDto.report_json);
      
      if (timedOut) {
        return;
      }

      const pdfBuffer = await this.pdfService.generate(html);

      if (timedOut) {
        return;
      }

      clearTimeout(timeoutId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      res.send(pdfBuffer);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('PDF generation error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to generate PDF',
          message: error.message,
        });
      }
    }
  }

  @Post('generate-stock-report')
  @ApiOperation({
    summary: 'Generate a comprehensive stock analysis report',
    description:
      'Generates a detailed financial analysis report for a Vietnamese stock code using AI. The report includes key highlights, business overview, financial analysis, valuation scenarios, and investment conclusion. Returns a downloadable PDF file.',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF report generated successfully',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - stock_code is required' })
  @ApiResponse({ status: 408, description: 'Request timeout - Report generation took too long' })
  @ApiResponse({ status: 500, description: 'Report generation error' })
  async generateStockReport(
    @Body() generateStockReportDto: GenerateStockReportDto,
    @Res() res: Response,
  ) {
    const timeout = TIMEOUTS.STOCK_REPORT_GENERATION;
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        res.status(408).json({ error: 'Stock report generation timed out' });
      }
    }, timeout);

    try {
      strapi.log.info(`Starting stock report generation for ${generateStockReportDto.stock_code}...`);

      const reportData = await this.stockReportService.generateStockReport(
        generateStockReportDto.stock_code,
      );

      if (timedOut) {
        return;
      }

      const html = this.htmlGeneratorService.generateReportHTML(reportData);

      if (timedOut) {
        return;
      }

      const pdfBuffer = await this.pdfService.generate(html);

      if (timedOut) {
        return;
      }

      clearTimeout(timeoutId);

      const safeStockCode = generateStockReportDto.stock_code.replace(/[^a-zA-Z0-9]/g, '');
      const filename = `${safeStockCode}-stock-report.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      res.send(pdfBuffer);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Stock report generation error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to generate stock report',
          message: error.message,
        });
      }
    }
  }

  @Post('test-valuation-prompt')
  @ApiOperation({
    summary: 'Test valuation section generation (DEBUG)',
    description: 'Test endpoint to isolate and debug the valuation prompt generation',
  })
  @ApiResponse({ status: 200, description: 'Valuation prompt test result' })
  @ApiResponse({ status: 500, description: 'Test failed' })
  async testValuationPrompt(@Body() body: { stock_code: string }) {
    try {
      if (!body.stock_code) {
        throw new HttpException(
          { error: 'stock_code is required' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const valuationPrompt = `Bạn là nhà phân tích định giá thị trường chứng khoán Việt Nam (HOSE/HNX).

Hãy phân tích định giá cho mã cổ phiếu Việt Nam ${body.stock_code} trên sàn HOSE/HNX. Trả về JSON hợp lệ.

LƯU Ý: ${body.stock_code} là mã cổ phiếu VIỆT NAM (VD: VIC = Vingroup, VNM = Vinamilk). KHÔNG định giá công ty nước ngoài.`;

      strapi.log.info('\n=== TESTING VALUATION PROMPT ===');
      strapi.log.info('Stock code:', body.stock_code);
      strapi.log.info('Prompt length:', valuationPrompt.length);

      const result = await this.openAIService.askOpenAIWithRetry(valuationPrompt, '', 1);

      strapi.log.info('\n=== RAW API RESPONSE ===');
      strapi.log.info('Response length:', result.answers?.length || 0);
      strapi.log.info('ConversationID:', result.conversationID);
      strapi.log.info('First 1000 chars:', result.answers?.substring(0, 1000));

      let parsedData = null;
      let parseMethod = 'none';

      try {
        parsedData = JSON.parse(result.answers);
        parseMethod = 'direct';
        strapi.log.info('\n✓ Direct JSON parse succeeded');
      } catch (e: any) {
        strapi.log.info('\n✗ Direct JSON parse failed:', e.message);
        parseMethod = 'extraction';
      }

      return {
        success: !!parsedData,
        parseMethod,
        rawResponse: result.answers,
        rawResponseLength: result.answers?.length || 0,
        parsedData,
        conversationID: result.conversationID,
      };
    } catch (error: any) {
      console.error('\n=== VALUATION TEST ERROR ===');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);

      throw new HttpException(
        {
          error: 'Valuation test failed',
          message: error.message,
          stack: error.stack,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
