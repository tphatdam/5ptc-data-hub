import { Module } from '@nestjs/common';
import { PdfModule } from './pdf/pdf.module';
import { DailyStockReportModule } from './daily-stock-report/daily-stock-report.module';

@Module({
  imports: [PdfModule, DailyStockReportModule],
  exports: [PdfModule, DailyStockReportModule],
})
export class ReportingModule {}
