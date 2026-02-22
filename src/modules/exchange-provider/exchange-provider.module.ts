import { Module } from '@nestjs/common';
import { CompanyDataModule } from '../company-data/company-data.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { LegacyTransitionModule } from '../legacy-transition/legacy-transition.module';
import { MarketCompanyModule } from '../market-company/market-company.module';
import { MarketContentModule } from '../market-content/market-content.module';
import { MarketCoreModule } from '../market-core/market-core.module';
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
    MarketCompanyModule,
    MarketContentModule,
    MarketCoreModule,
    LegacyTransitionModule,
    MarketIngestionModule,
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
    MarketCompanyModule,
    MarketContentModule,
    MarketCoreModule,
    LegacyTransitionModule,
    MarketIngestionModule,
  ],
})
export class ExchangeProviderModule {}
