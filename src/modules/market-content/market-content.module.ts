import { Module } from '@nestjs/common';
import { DataHubModule } from '../data-hub/data-hub.module';
import { ApiProvidersModule } from '../api-compatibility/providers/api-providers.module';
import { AiCrawlerProvider } from '../api-compatibility/providers/ai-crawler.provider';
import { MarketContentApiController } from './market-content-api.controller';
import { MarketContentApiService } from './market-content-api.service';
import { CONTENT_PROVIDER } from './market-content-api.service';

@Module({
  imports: [DataHubModule, ApiProvidersModule],
  controllers: [MarketContentApiController],
  providers: [
    MarketContentApiService,
    {
      provide: CONTENT_PROVIDER,
      useExisting: AiCrawlerProvider,
    },
  ],
  exports: [DataHubModule],
})
export class MarketContentModule {}
