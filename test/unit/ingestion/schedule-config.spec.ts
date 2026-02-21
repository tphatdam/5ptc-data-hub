import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { IngestionService } from '../../../src/modules/ingestion/ingestion.service';
import { SymbolsRepository } from '../../../src/modules/symbols/symbols.repository';
import { QuoteDailyRepository } from '../../../src/modules/quotes/quote-daily.repository';
import { QuoteIntradayRepository } from '../../../src/modules/quotes/quote-intraday.repository';
import { CrawlRunsRepository } from '../../../src/modules/ingestion/crawl-runs.repository';
import { ForeignTradingDailyRepository } from '../../../src/modules/company-data/foreign-trading-daily.repository';
import { InsiderTradingEventRepository } from '../../../src/modules/company-data/insider-trading-event.repository';
import { StockRelatedPeerRepository } from '../../../src/modules/company-data/stock-related-peer.repository';
import { CompanySubsidiaryRepository } from '../../../src/modules/company-data/company-subsidiary.repository';
import { NewsArticleRepository } from '../../../src/modules/company-data/news-article.repository';
import { CompanyReportRepository } from '../../../src/modules/company-data/company-report.repository';
import { SimplizeService } from '../../../src/modules/providers/simplize/simplize.service';
import {
  DailyCompanyCompositeJob,
  EodDailyJob,
  IntradayMarketJob,
} from '../../../src/modules/data-hub/jobs';

describe('IngestionService - Schedule Configuration', () => {
  let service: IngestionService;
  let configService: ConfigService;
  let schedulerRegistry: SchedulerRegistry;

  const baseProviders = [
    { provide: SymbolsRepository, useValue: {} },
    { provide: QuoteDailyRepository, useValue: {} },
    { provide: QuoteIntradayRepository, useValue: {} },
    { provide: ForeignTradingDailyRepository, useValue: {} },
    { provide: InsiderTradingEventRepository, useValue: {} },
    { provide: StockRelatedPeerRepository, useValue: {} },
    { provide: CompanySubsidiaryRepository, useValue: {} },
    { provide: NewsArticleRepository, useValue: {} },
    { provide: CompanyReportRepository, useValue: {} },
    { provide: SimplizeService, useValue: {} },
    { provide: CrawlRunsRepository, useValue: {} },
    {
      provide: 'MarketProvider',
      useValue: {
        name: 'TestProvider',
      },
    },
    { provide: IntradayMarketJob, useValue: { runNow: jest.fn(async () => ({ status: 'triggered' })) } },
    { provide: DailyCompanyCompositeJob, useValue: { runNow: jest.fn(async () => undefined) } },
    { provide: EodDailyJob, useValue: { runNow: jest.fn(async () => undefined) } },
  ];

  const stopRegisteredJobs = (registry: SchedulerRegistry) => {
    const addCronJobMock = (registry.addCronJob as jest.Mock | undefined);
    if (!addCronJobMock) {
      return;
    }
    for (const call of addCronJobMock.mock.calls) {
      const job = call[1] as { stop?: () => void } | undefined;
      job?.stop?.();
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'schedule.quoteHourlyCron': '0 * * * *',
                'schedule.dailyCompanyCron': '0 18 * * *',
                'schedule.timezone': 'Asia/Ho_Chi_Minh',
              };
              return config[key];
            }),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            getCronJob: jest.fn(),
          },
        },
        ...baseProviders,
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
    configService = module.get<ConfigService>(ConfigService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  afterEach(() => {
    stopRegisteredJobs(schedulerRegistry);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register quote-hourly job with configured cron expression', () => {
    service.onModuleInit();

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith('quote-hourly', expect.any(Object));
  });

  it('should register daily-company job with configured cron expression', () => {
    service.onModuleInit();

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith('daily-company', expect.any(Object));
  });

  it('should use default cron expressions when config is not provided', async () => {
    const moduleWithDefaults: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            getCronJob: jest.fn(),
          },
        },
        ...baseProviders,
      ],
    }).compile();

    const serviceWithDefaults = moduleWithDefaults.get<IngestionService>(IngestionService);
    const schedulerRegistryWithDefaults = moduleWithDefaults.get<SchedulerRegistry>(SchedulerRegistry);

    serviceWithDefaults.onModuleInit();

    expect(schedulerRegistryWithDefaults.addCronJob).toHaveBeenCalledTimes(2);
    stopRegisteredJobs(schedulerRegistryWithDefaults);
  });

  it('should use custom cron expressions from configuration', async () => {
    const customQuoteHourlyCron = '*/30 * * * *';
    const customDailyCompanyCron = '0 19 * * *';
    const customTimezone = 'America/New_York';

    const moduleWithCustom: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'schedule.quoteHourlyCron': customQuoteHourlyCron,
                'schedule.dailyCompanyCron': customDailyCompanyCron,
                'schedule.timezone': customTimezone,
              };
              return config[key];
            }),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            getCronJob: jest.fn(),
          },
        },
        ...baseProviders,
      ],
    }).compile();

    const serviceWithCustom = moduleWithCustom.get<IngestionService>(IngestionService);
    const configServiceWithCustom = moduleWithCustom.get<ConfigService>(ConfigService);

    serviceWithCustom.onModuleInit();

    expect(configServiceWithCustom.get).toHaveBeenCalledWith('schedule.quoteHourlyCron');
    expect(configServiceWithCustom.get).toHaveBeenCalledWith('schedule.dailyCompanyCron');
    expect(configServiceWithCustom.get).toHaveBeenCalledWith('schedule.timezone');
    stopRegisteredJobs(moduleWithCustom.get<SchedulerRegistry>(SchedulerRegistry));
  });

  it('should skip legacy scheduler registration when unified mode is datahub', async () => {
    const moduleWithDatahub: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'unified.mode') {
                return 'datahub';
              }
              return undefined;
            }),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            getCronJob: jest.fn(),
          },
        },
        ...baseProviders,
      ],
    }).compile();

    const serviceWithDatahub = moduleWithDatahub.get<IngestionService>(IngestionService);
    const schedulerWithDatahub = moduleWithDatahub.get<SchedulerRegistry>(SchedulerRegistry);

    serviceWithDatahub.onModuleInit();

    expect(schedulerWithDatahub.addCronJob).not.toHaveBeenCalled();
  });
});
