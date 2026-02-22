import { Injectable } from '@nestjs/common';
import { IngestionService } from '../../../ingestion/ingestion.service';
import { MarketIngestionPort } from '../../domain/ports/market-ingestion.port';
import { TriggerRunStatusDto } from '../../application/dto/trigger-run-status.dto';
import { TriggerOrchestratorService } from '../services/trigger-orchestrator.service';

@Injectable()
export class LegacyMarketIngestionAdapter implements MarketIngestionPort {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly triggerOrchestratorService: TriggerOrchestratorService,
  ) {}

  runQuoteHourly(): Promise<void> {
    return this.ingestionService.runQuoteHourly();
  }

  runDailyCompany(): Promise<void> {
    return this.ingestionService.runDailyCompany();
  }

  runDailyEod(): Promise<void> {
    return this.ingestionService.runDailyEOD();
  }

  runAllTriggers(): Promise<{ runId: string; acceptedAt: string; mode: 'full' }> {
    return this.triggerOrchestratorService.enqueueRunAll();
  }

  getTriggerRunStatus(runId: string): Promise<TriggerRunStatusDto> {
    return this.triggerOrchestratorService.getRunStatus(runId);
  }
}
