import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyStockReportEntity } from './daily-stock-report.entity';
import { DailyStockReportService } from './daily-stock-report.service';
import { DailyStockReportController } from './daily-stock-report.controller';
import { ReportProcessor } from './report.processor';
import { QueueModule } from '../queue/queue.module';
import { PdfModule } from '../pdf/pdf.module';
import { S3Module } from '../common/s3.module';
import { BrevoModule } from '../brevo/brevo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyStockReportEntity]),
    QueueModule,
    PdfModule,
    S3Module,
    BrevoModule,
  ],
  controllers: [DailyStockReportController],
  providers: [DailyStockReportService, ReportProcessor],
  exports: [DailyStockReportService],
})
export class DailyStockReportModule {}
