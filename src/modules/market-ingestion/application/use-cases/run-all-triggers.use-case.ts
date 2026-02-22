import { Inject, Injectable, Logger } from '@nestjs/common';
import { MARKET_INGESTION_PORT } from '../../domain/ports/tokens';
import { MarketIngestionPort } from '../../domain/ports/market-ingestion.port';

@Injectable()
export class RunAllTriggersUseCase {
  private readonly logger = new Logger(RunAllTriggersUseCase.name);

  constructor(
    @Inject(MARKET_INGESTION_PORT)
    private readonly marketIngestionPort: MarketIngestionPort,
  ) {}

  async execute(): Promise<{ runId: string; acceptedAt: string; mode: 'full' }> {
    this.logger.log('Executing run-all triggers use case');
    return this.marketIngestionPort.runAllTriggers();
  }
}
