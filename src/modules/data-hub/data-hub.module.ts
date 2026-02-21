import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';
import { SimplizeModule } from '../providers/simplize/simplize.module';

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
  StockForeignTradingDaily,
  StockInsiderEvent,
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
  SimplizeProvider,
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
  CompanyIntelJob,
  CompanyIntelProcessor,
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
  StockForeignTradingDaily,
  StockInsiderEvent,
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
  SimplizeProvider,
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
  CompanyIntelJob,
  CompanyIntelProcessor,
];

@Module({
  imports: [
    ConfigModule,
    ScheduleModule,
    TypeOrmModule.forFeature(entities),
    QueueModule,
    SimplizeModule,
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
