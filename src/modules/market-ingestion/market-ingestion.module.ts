import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../queue/queue.module';
import { MarketPricingModule } from '../market-pricing/market-pricing.module';
import { MarketCompanyModule } from '../market-company/market-company.module';
import { MarketContentModule } from '../market-content/market-content.module';
import { MarketReferenceModule } from '../market-reference/market-reference.module';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import { RunQuoteHourlyUseCase } from './application/use-cases/run-quote-hourly.use-case';
import { RunDailyCompanyUseCase } from './application/use-cases/run-daily-company.use-case';
import { RunDailyEodUseCase } from './application/use-cases/run-daily-eod.use-case';
import { RunAllTriggersUseCase } from './application/use-cases/run-all-triggers.use-case';
import { GetTriggerRunStatusUseCase } from './application/use-cases/get-trigger-run-status.use-case';
import { MARKET_INGESTION_PORT } from './domain/ports/tokens';
import { DataHubMarketIngestionAdapter } from './infrastructure/adapters/datahub-market-ingestion.adapter';
import { TriggerOrchestratorService } from './infrastructure/services/trigger-orchestrator.service';
import { TriggerOrchestratorProcessor } from './infrastructure/processors/trigger-orchestrator.processor';
import { TriggerRunService } from './application/services/trigger-run.service';
import { MarketTriggersController } from './presentation/controllers/market-triggers.controller';
import { TriggerRun, TriggerRunStep } from './infrastructure/entities';

@Module({
  imports: [
    QueueModule,
    MarketPricingModule,
    MarketCompanyModule,
    MarketContentModule,
    MarketReferenceModule,
    TypeOrmModule.forFeature([TriggerRun, TriggerRunStep]),
  ],
  controllers: [MarketTriggersController],
  providers: [
    InternalApiKeyGuard,
    RunQuoteHourlyUseCase,
    RunDailyCompanyUseCase,
    RunDailyEodUseCase,
    RunAllTriggersUseCase,
    GetTriggerRunStatusUseCase,
    DataHubMarketIngestionAdapter,
    TriggerRunService,
    TriggerOrchestratorService,
    TriggerOrchestratorProcessor,
    {
      provide: MARKET_INGESTION_PORT,
      useExisting: DataHubMarketIngestionAdapter,
    },
  ],
  exports: [
    RunQuoteHourlyUseCase,
    RunDailyCompanyUseCase,
    RunDailyEodUseCase,
    RunAllTriggersUseCase,
    GetTriggerRunStatusUseCase,
  ],
})
export class MarketIngestionModule {}
