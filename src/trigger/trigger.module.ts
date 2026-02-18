import { Module } from '@nestjs/common';
import { MarketIngestionModule } from '../modules/market-ingestion/market-ingestion.module';

@Module({
  imports: [MarketIngestionModule],
})
export class TriggerModule {}
