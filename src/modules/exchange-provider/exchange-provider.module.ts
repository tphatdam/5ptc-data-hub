import { Module } from '@nestjs/common';
import { CompanyDataModule } from '../company-data/company-data.module';
import { CompanyIntelModule } from '../company-intel/company-intel.module';
import { DataHubModule } from '../data-hub/data-hub.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { MarketIngestionModule } from '../market-ingestion/market-ingestion.module';
import { MarketPricingModule } from '../market-pricing/market-pricing.module';
import { MarketReferenceModule } from '../market-reference/market-reference.module';
import { ProvidersModule } from '../providers/providers.module';
import { QuotesModule } from '../quotes/quotes.module';
import { SeedModule } from '../seed/seed.module';
import { SymbolsModule } from '../symbols/symbols.module';

@Module({
  imports: [
    ProvidersModule,
    QuotesModule,
    IngestionModule,
    CompanyDataModule,
    SeedModule,
    SymbolsModule,
    MarketReferenceModule,
    MarketPricingModule,
    CompanyIntelModule,
    MarketIngestionModule,
    DataHubModule,
  ],
  exports: [
    ProvidersModule,
    QuotesModule,
    IngestionModule,
    CompanyDataModule,
    SeedModule,
    SymbolsModule,
    MarketReferenceModule,
    MarketPricingModule,
    CompanyIntelModule,
    MarketIngestionModule,
    DataHubModule,
  ],
})
export class ExchangeProviderModule {}
