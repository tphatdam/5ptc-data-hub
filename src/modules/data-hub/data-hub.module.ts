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
  LegacyBackfillState,
  LegacyBackfillError,
} from './entities';

import {
  MarketHoursService,
  HttpClientService,
  CheerioParserService,
  AdvisoryLockService,
  JobRunService,
  UpsertService,
  LegacyBackfillService,
  LegacyCompatViewService,
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
  DailyCompanyCompositeJob,
  LegacyBackfillJob,
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
  LegacyBackfillState,
  LegacyBackfillError,
];

const services = [
  MarketHoursService,
  HttpClientService,
  CheerioParserService,
  AdvisoryLockService,
  JobRunService,
  UpsertService,
  LegacyBackfillService,
  LegacyCompatViewService,
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
  DailyCompanyCompositeJob,
  LegacyBackfillJob,
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
