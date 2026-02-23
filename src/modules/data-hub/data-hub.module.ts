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
  StockRelatedPeer,
  CompanySubsidiary,
  CompanyReport,
} from './entities';

import {
  MarketHoursService,
  HttpClientService,
  CheerioParserService,
  AdvisoryLockService,
  JobRunService,
  UpsertService,
  StartupSeedService,
} from './services';

import {
  TcbsProvider,
  ProviderRegistryService,
  ProviderFactoryService,
  DynamicProviderAdapter,
  SimplizeProvider,
  SStockProvider,
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
  DailyCompanyCompositeJob,
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
  StockRelatedPeer,
  CompanySubsidiary,
  CompanyReport,
];

const services = [
  MarketHoursService,
  HttpClientService,
  CheerioParserService,
  AdvisoryLockService,
  JobRunService,
  UpsertService,
  StartupSeedService,
];

const providers = [
  TcbsProvider,
  ProviderRegistryService,
  ProviderFactoryService,
  DynamicProviderAdapter,
  SimplizeProvider,
  SStockProvider,
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
  DailyCompanyCompositeJob,
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
