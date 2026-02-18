import { Inject, Injectable, Logger } from '@nestjs/common';
import { MARKET_INGESTION_PORT } from '../../domain/ports/tokens';
import { MarketIngestionPort } from '../../domain/ports/market-ingestion.port';

@Injectable()
export class RunQuoteHourlyUseCase {
  private readonly logger = new Logger(RunQuoteHourlyUseCase.name);

  constructor(
    @Inject(MARKET_INGESTION_PORT)
    private readonly marketIngestionPort: MarketIngestionPort,
  ) {}

  async execute(): Promise<void> {
    this.logger.log('Executing quote-hourly ingestion use case');
    await this.marketIngestionPort.runQuoteHourly();
  }
}
