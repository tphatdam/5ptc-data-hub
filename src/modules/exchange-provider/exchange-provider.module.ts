import { Module } from '@nestjs/common';
import { MarketCompanyModule } from '../market-company/market-company.module';
import { MarketContentModule } from '../market-content/market-content.module';
import { MarketCoreModule } from '../market-core/market-core.module';
import { MarketIngestionModule } from '../market-ingestion/market-ingestion.module';
import { MarketPricingModule } from '../market-pricing/market-pricing.module';
import { MarketReferenceModule } from '../market-reference/market-reference.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [
    ProvidersModule,
    MarketReferenceModule,
    MarketPricingModule,
    MarketCompanyModule,
    MarketContentModule,
    MarketCoreModule,
    MarketIngestionModule,
  ],
  exports: [
    ProvidersModule,
    MarketReferenceModule,
    MarketPricingModule,
    MarketCompanyModule,
    MarketContentModule,
    MarketCoreModule,
    MarketIngestionModule,
  ],
})
export class ExchangeProviderModule {}
