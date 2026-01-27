import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

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
  ProviderFactoryService,
} from './providers';

import {
  IntradayMarketJob,
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
  ProviderFactoryService,
];

const jobs = [
  IntradayMarketJob,
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
