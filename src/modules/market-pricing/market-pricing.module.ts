import { Module } from '@nestjs/common';
import { DataHubModule } from '../data-hub/data-hub.module';
import { ApiProvidersModule } from '../api-compatibility/providers/api-providers.module';
import { VnStockProvider } from '../api-compatibility/providers/vnstock.provider';
import { MarketPricingApiController } from './market-pricing-api.controller';
import { MarketPricingApiService } from './market-pricing-api.service';
import { PRICING_PROVIDER } from './market-pricing-api.service';

@Module({
  imports: [DataHubModule, ApiProvidersModule],
  controllers: [MarketPricingApiController],
  providers: [
    MarketPricingApiService,
    {
      provide: PRICING_PROVIDER,
      useExisting: VnStockProvider,
    },
  ],
  exports: [DataHubModule],
})
export class MarketPricingModule {}
