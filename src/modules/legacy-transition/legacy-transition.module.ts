import { Module } from '@nestjs/common';
import { DataHubModule } from '../data-hub/data-hub.module';

@Module({
  imports: [DataHubModule],
  exports: [DataHubModule],
})
export class LegacyTransitionModule {}
