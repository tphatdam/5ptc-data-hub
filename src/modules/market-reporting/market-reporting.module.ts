import { Module } from '@nestjs/common';
import { ApiProvidersModule } from '../api-compatibility/providers/api-providers.module';
import { AiCrawlerProvider } from '../api-compatibility/providers/ai-crawler.provider';
import { MarketReportingApiController } from './market-reporting-api.controller';
import { MarketReportingApiService } from './market-reporting-api.service';
import { REPORTING_PROVIDER } from './market-reporting-api.service';

@Module({
  imports: [ApiProvidersModule],
  controllers: [MarketReportingApiController],
  providers: [
    MarketReportingApiService,
    {
      provide: REPORTING_PROVIDER,
      useExisting: AiCrawlerProvider,
    },
  ],
  exports: [MarketReportingApiService],
})
export class MarketReportingModule {}
