import { Injectable } from '@nestjs/common';
import { MarketIngestionPort } from '../../domain/ports/market-ingestion.port';
import { TriggerRunStatusDto } from '../../application/dto/trigger-run-status.dto';
import { TriggerOrchestratorService } from '../services/trigger-orchestrator.service';
import {
  DailyCompanyCompositeJob,
  EodDailyJob,
  IntradayMarketJob,
} from '../../../data-hub/jobs';

@Injectable()
export class DataHubMarketIngestionAdapter implements MarketIngestionPort {
  constructor(
    private readonly intradayMarketJob: IntradayMarketJob,
    private readonly dailyCompanyCompositeJob: DailyCompanyCompositeJob,
    private readonly eodDailyJob: EodDailyJob,
    private readonly triggerOrchestratorService: TriggerOrchestratorService,
  ) {}

  async runQuoteHourly(): Promise<void> {
    await this.intradayMarketJob.runNow();
  }

  async runDailyCompany(): Promise<void> {
    await this.dailyCompanyCompositeJob.runNow();
  }

  async runDailyEod(): Promise<void> {
    await this.eodDailyJob.runNow();
  }

  runAllTriggers(): Promise<{ runId: string; acceptedAt: string; mode: 'full' }> {
    return this.triggerOrchestratorService.enqueueRunAll();
  }

  getTriggerRunStatus(runId: string): Promise<TriggerRunStatusDto> {
    return this.triggerOrchestratorService.getRunStatus(runId);
  }
}
