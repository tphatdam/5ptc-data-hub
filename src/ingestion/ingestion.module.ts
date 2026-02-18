import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { IngestionService } from './ingestion.service';
import { CrawlRunsRepository } from './crawl-runs.repository';
import { CrawlRun } from '../db/entities/crawl-run.entity';
import { SymbolsModule } from '../symbols/symbols.module';
import { QuotesModule } from '../quotes/quotes.module';
import { ProvidersModule } from '../providers/providers.module';
import { CompanyDataModule } from '../company-data/company-data.module';
import { SimplizeModule } from '../providers/simplize/simplize.module';

@Module({
  imports: [
    ScheduleModule,
    TypeOrmModule.forFeature([CrawlRun]),
    SymbolsModule,
    QuotesModule,
    ProvidersModule,
    CompanyDataModule,
    SimplizeModule,
  ],
  providers: [IngestionService, CrawlRunsRepository],
  exports: [IngestionService, CrawlRunsRepository],
})
export class IngestionModule {}
