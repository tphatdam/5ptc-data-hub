import { Inject, Injectable, Logger } from '@nestjs/common';
import { MARKET_INGESTION_PORT } from '../../domain/ports/tokens';
import { MarketIngestionPort } from '../../domain/ports/market-ingestion.port';
import { TriggerRunStatusDto } from '../dto/trigger-run-status.dto';

@Injectable()
export class GetTriggerRunStatusUseCase {
  private readonly logger = new Logger(GetTriggerRunStatusUseCase.name);

  constructor(
    @Inject(MARKET_INGESTION_PORT)
    private readonly marketIngestionPort: MarketIngestionPort,
  ) {}

  async execute(runId: string): Promise<TriggerRunStatusDto> {
    this.logger.log(`Fetching trigger run status for runId=${runId}`);
    return this.marketIngestionPort.getTriggerRunStatus(runId);
  }
}
