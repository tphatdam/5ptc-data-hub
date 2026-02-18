import { Injectable } from '@nestjs/common';
import { IngestionService } from '../../../../ingestion/ingestion.service';
import { MarketIngestionPort } from '../../domain/ports/market-ingestion.port';

@Injectable()
export class LegacyMarketIngestionAdapter implements MarketIngestionPort {
  constructor(private readonly ingestionService: IngestionService) {}

  runQuoteHourly(): Promise<void> {
    return this.ingestionService.runQuoteHourly();
  }

  runDailyCompany(): Promise<void> {
    return this.ingestionService.runDailyCompany();
  }
}
