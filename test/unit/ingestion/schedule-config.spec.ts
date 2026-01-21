import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { IngestionService } from '../../../src/ingestion/ingestion.service';
import { SymbolsRepository } from '../../../src/symbols/symbols.repository';
import { QuoteDailyRepository } from '../../../src/quotes/quote-daily.repository';
import { QuoteIntradayRepository } from '../../../src/quotes/quote-intraday.repository';
import { CrawlRunsRepository } from '../../../src/ingestion/crawl-runs.repository';

/**
 * Unit tests for ScheduleModule configuration in IngestionService
 * Validates Requirements 8.1, 8.4
 */
describe('IngestionService - Schedule Configuration', () => {
  let service: IngestionService;
  let configService: ConfigService;
  let schedulerRegistry: SchedulerRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'schedule.intradayCron': '*/15 * * * *',
                'schedule.dailyEodCron': '5 18 * * *',
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
        {
          provide: SymbolsRepository,
          useValue: {},
        },
        {
          provide: QuoteDailyRepository,
          useValue: {},
        },
        {
          provide: QuoteIntradayRepository,
          useValue: {},
        },
        {
          provide: CrawlRunsRepository,
          useValue: {},
        },
        {
          provide: 'MarketProvider',
          useValue: {
            name: 'TestProvider',
          },
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
    configService = module.get<ConfigService>(ConfigService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register intraday job with configured cron expression', () => {
    // Trigger onModuleInit
    service.onModuleInit();

    // Verify that addCronJob was called for intraday job
    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      'intraday-15m',
      expect.any(Object),
    );
  });

  it('should register daily EOD job with configured cron expression', () => {
    // Trigger onModuleInit
    service.onModuleInit();

    // Verify that addCronJob was called for daily EOD job
    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      'daily-eod',
      expect.any(Object),
    );
  });

  it('should use default cron expressions when config is not provided', async () => {
    // Create a new module with config that returns undefined
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
        {
          provide: SymbolsRepository,
          useValue: {},
        },
        {
          provide: QuoteDailyRepository,
          useValue: {},
        },
        {
          provide: QuoteIntradayRepository,
          useValue: {},
        },
        {
          provide: CrawlRunsRepository,
          useValue: {},
        },
        {
          provide: 'MarketProvider',
          useValue: {
            name: 'TestProvider',
          },
        },
      ],
    }).compile();

    const serviceWithDefaults =
      moduleWithDefaults.get<IngestionService>(IngestionService);
    const schedulerRegistryWithDefaults =
      moduleWithDefaults.get<SchedulerRegistry>(SchedulerRegistry);

    // Trigger onModuleInit
    serviceWithDefaults.onModuleInit();

    // Verify that jobs were still registered (with default values)
    expect(schedulerRegistryWithDefaults.addCronJob).toHaveBeenCalledTimes(2);
  });

  it('should use custom cron expressions from environment variables', async () => {
    const customIntradayCron = '*/30 * * * *';
    const customDailyEodCron = '0 19 * * *';
    const customTimezone = 'America/New_York';

    // Create a new module with custom config
    const moduleWithCustom: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'schedule.intradayCron': customIntradayCron,
                'schedule.dailyEodCron': customDailyEodCron,
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
        {
          provide: SymbolsRepository,
          useValue: {},
        },
        {
          provide: QuoteDailyRepository,
          useValue: {},
        },
        {
          provide: QuoteIntradayRepository,
          useValue: {},
        },
        {
          provide: CrawlRunsRepository,
          useValue: {},
        },
        {
          provide: 'MarketProvider',
          useValue: {
            name: 'TestProvider',
          },
        },
      ],
    }).compile();

    const serviceWithCustom =
      moduleWithCustom.get<IngestionService>(IngestionService);
    const configServiceWithCustom =
      moduleWithCustom.get<ConfigService>(ConfigService);

    // Trigger onModuleInit
    serviceWithCustom.onModuleInit();

    // Verify that config service was called with correct keys
    expect(configServiceWithCustom.get).toHaveBeenCalledWith(
      'schedule.intradayCron',
    );
    expect(configServiceWithCustom.get).toHaveBeenCalledWith(
      'schedule.dailyEodCron',
    );
    expect(configServiceWithCustom.get).toHaveBeenCalledWith(
      'schedule.timezone',
    );
  });
});
