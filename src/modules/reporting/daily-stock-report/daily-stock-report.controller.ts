import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DailyStockReportService } from './daily-stock-report.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { DailyStockReportResponseDto } from './dto/daily-stock-report-response.dto';

@ApiTags('Daily Stock Report')
@Controller('daily-stock-report')
export class DailyStockReportController {
  constructor(
    private readonly dailyStockReportService: DailyStockReportService,
  ) {}

  @Get(':stockCode')
  @ApiOperation({ summary: 'Get today\'s daily stock report by stock code (creates placeholder and enqueues job if not exists)' })
  @ApiParam({ name: 'stockCode', description: 'Stock code (e.g., VNM, FPT)', type: String })
  @ApiResponse({ status: 200, description: 'Stock report found or placeholder created', type: DailyStockReportResponseDto })
  async getTodayReport(
    @Param('stockCode') stockCode: string,
  ): Promise<DailyStockReportResponseDto> {
    const requestId = `GET_${stockCode}_${Date.now()}`;
    strapi.log.info(`[DailyStockReportController][${requestId}] GET request - Stock: ${stockCode}`);
    
    try {
      const startTime = Date.now();
      const result = await this.dailyStockReportService.getOrCreateToday(stockCode);
      const duration = Date.now() - startTime;
      
      strapi.log.info(`[DailyStockReportController][${requestId}] GET completed in ${duration}ms - Response: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      console.error(`[DailyStockReportController][${requestId}] GET failed - Stock: ${stockCode}, Error:`, error);
      throw error;
    }
  }

  @Post(':stock_code')
  @ApiOperation({ summary: 'Generate a daily stock report' })
  @ApiParam({ name: 'stock_code', description: 'Stock code', type: String })
  async generateReport(
    @Param('stock_code') stockCode: string,
    @Body() generateReportDto: GenerateReportDto,
  ) {
    const requestId = `${stockCode}_${Date.now()}`;
    strapi.log.info(`[DailyStockReportController][${requestId}] Incoming request - Stock: ${stockCode}, Email: ${generateReportDto.email}`);
    
    try {
      const startTime = Date.now();
      const result = await this.dailyStockReportService.getStockReport(
        stockCode,
        generateReportDto.email,
      );
      const duration = Date.now() - startTime;
      
      strapi.log.info(`[DailyStockReportController][${requestId}] Request completed in ${duration}ms - Response: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      console.error(`[DailyStockReportController][${requestId}] Request failed - Stock: ${stockCode}, Email: ${generateReportDto.email}, Error:`, error);
      throw error;
    }
  }
}
