import { TriggerRunStatusDto } from '../../application/dto/trigger-run-status.dto';

export interface MarketIngestionPort {
  runQuoteHourly(): Promise<void>;
  runDailyCompany(): Promise<void>;
  runDailyEod(): Promise<void>;
  runAllTriggers(): Promise<{ runId: string; acceptedAt: string; mode: 'full' }>;
  getTriggerRunStatus(runId: string): Promise<TriggerRunStatusDto>;
}
