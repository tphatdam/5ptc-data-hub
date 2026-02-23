import { Module } from '@nestjs/common';
import { DataHubModule } from '../data-hub/data-hub.module';
import { MarketCompanyModule } from '../market-company/market-company.module';
import { AgentDataController } from './agent-data.controller';
import { AgentDataService } from './agent-data.service';

@Module({
  imports: [DataHubModule, MarketCompanyModule],
  controllers: [AgentDataController],
  providers: [AgentDataService],
  exports: [AgentDataService],
})
export class AgentDataModule {}
