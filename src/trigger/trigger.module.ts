import { Module } from '@nestjs/common';
import { DataHubModule } from '../data-hub/data-hub.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { TriggerController } from './trigger.controller';
import { InternalApiKeyGuard } from '../common/guards/internal-api-key.guard';

@Module({
  imports: [IngestionModule, DataHubModule],
  controllers: [TriggerController],
  providers: [InternalApiKeyGuard],
})
export class TriggerModule {}

