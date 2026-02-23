import { Module } from '@nestjs/common';
import { ApiProvidersModule } from '../api-compatibility/providers/api-providers.module';
import { SStockApiProvider } from '../api-compatibility/providers/sstock-api.provider';
import { MarketRecommendationApiController } from './market-recommendation-api.controller';
import { MarketRecommendationApiService } from './market-recommendation-api.service';
import { RECOMMENDATION_PROVIDER } from './market-recommendation-api.service';

@Module({
  imports: [ApiProvidersModule],
  controllers: [MarketRecommendationApiController],
  providers: [
    MarketRecommendationApiService,
    {
      provide: RECOMMENDATION_PROVIDER,
      useExisting: SStockApiProvider,
    },
  ],
  exports: [MarketRecommendationApiService],
})
export class MarketRecommendationModule {}
