import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';

import {
  DataSource,
  Exchange,
  Symbol,
  MarketIndex,
  IndexCandle,
  StockCandle,
  StockSnapshot,
  GoldPrice,
  NewsArticle,
  JobRun,
} from './entities';

import {
  MarketHoursService,
  HttpClientService,
  CheerioParserService,
  AdvisoryLockService,
  JobRunService,
  UpsertService,
} from './services';

import {
  TcbsProvider,
  ProviderRegistryService,
  ProviderFactoryService,
  DynamicProviderAdapter,
} from './providers';

import {
  IntradayMarketJob,
  IntradayMarketProcessor,
  EodDailyJob,
  FundamentalsJob,
  GoldJob,
  NewsJob,
  SymbolSyncJob,
  GapFillJob,
} from './jobs';

import { DataHubController } from './data-hub.controller';

const entities = [
  DataSource,
  Exchange,
  Symbol,
  MarketIndex,
  IndexCandle,
  StockCandle,
  StockSnapshot,
  GoldPrice,
  NewsArticle,
  JobRun,
];

const services = [
  MarketHoursService,
  HttpClientService,
  CheerioParserService,
  AdvisoryLockService,
  JobRunService,
  UpsertService,
];

const providers = [
  TcbsProvider,
  ProviderRegistryService,
  ProviderFactoryService,
  DynamicProviderAdapter,
];

const jobs = [
  IntradayMarketJob,
  IntradayMarketProcessor,
  EodDailyJob,
  FundamentalsJob,
  GoldJob,
  NewsJob,
  SymbolSyncJob,
  GapFillJob,
];

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature(entities),
    QueueModule,
  ],
  controllers: [DataHubController],
  providers: [...services, ...providers, ...jobs],
  exports: [
    TypeOrmModule,
    ...services,
    ...providers,
    ...jobs,
  ],
})
export class DataHubModule {}
