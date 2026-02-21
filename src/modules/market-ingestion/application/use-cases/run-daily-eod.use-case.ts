import { Inject, Injectable, Logger } from '@nestjs/common';
import { MARKET_INGESTION_PORT } from '../../domain/ports/tokens';
import { MarketIngestionPort } from '../../domain/ports/market-ingestion.port';

@Injectable()
export class RunDailyEodUseCase {
  private readonly logger = new Logger(RunDailyEodUseCase.name);

  constructor(
    @Inject(MARKET_INGESTION_PORT)
    private readonly marketIngestionPort: MarketIngestionPort,
  ) {}

  async execute(): Promise<void> {
    this.logger.log('Executing daily-eod ingestion use case');
    await this.marketIngestionPort.runDailyEod();
  }
}
