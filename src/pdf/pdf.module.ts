import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './services/pdf.service';
import { StockReportService } from './services/stock-report.service';
import { StockReportHTMLGeneratorService } from './services/stock-report-html-generator.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [PdfController],
  providers: [
    PdfService,
    StockReportService,
    StockReportHTMLGeneratorService,
  ],
  exports: [
    PdfService,
    StockReportService,
    StockReportHTMLGeneratorService,
  ],
})
export class PdfModule {}
