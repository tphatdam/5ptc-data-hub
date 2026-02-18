import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import { RunQuoteHourlyUseCase } from './application/use-cases/run-quote-hourly.use-case';
import { RunDailyCompanyUseCase } from './application/use-cases/run-daily-company.use-case';
import { MARKET_INGESTION_PORT } from './domain/ports/tokens';
import { LegacyMarketIngestionAdapter } from './infrastructure/adapters/legacy-market-ingestion.adapter';
import { MarketTriggersV1CompatController } from './presentation/controllers/market-triggers-v1-compat.controller';
import { MarketTriggersV2Controller } from './presentation/controllers/market-triggers-v2.controller';

@Module({
  imports: [IngestionModule],
  controllers: [MarketTriggersV2Controller, MarketTriggersV1CompatController],
  providers: [
    InternalApiKeyGuard,
    RunQuoteHourlyUseCase,
    RunDailyCompanyUseCase,
    LegacyMarketIngestionAdapter,
    {
      provide: MARKET_INGESTION_PORT,
      useExisting: LegacyMarketIngestionAdapter,
    },
  ],
  exports: [RunQuoteHourlyUseCase, RunDailyCompanyUseCase],
})
export class MarketIngestionModule {}
