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

type Setup = {
  service: IngestionService;
  intradayMarketJob: { runNow: jest.Mock };
  dailyCompanyCompositeJob: { runNow: jest.Mock };
  eodDailyJob: { runNow: jest.Mock };
  crawlRunsRepo: { createRun: jest.Mock; markSuccess: jest.Mock; markFailed: jest.Mock };
};

function createSetup(mode: 'legacy' | 'datahub'): Setup {
  const symbolsRepo = {
    getAllActive: jest.fn().mockResolvedValue([{ id: 'legacy-symbol-id', symbol: 'AAA' }]),
    upsertSymbol: jest.fn().mockResolvedValue(undefined),
  } as unknown as SymbolsRepository;

  const quoteDailyRepo = {
    bulkUpsert: jest.fn().mockResolvedValue(1),
  } as unknown as QuoteDailyRepository;

  const quoteIntradayRepo = {
    bulkUpsert: jest.fn().mockResolvedValue(1),
  } as unknown as QuoteIntradayRepository;

  const crawlRunsRepo = {
    createRun: jest.fn().mockResolvedValue({ id: 'crawl-run-id' }),
    markSuccess: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'unified.mode') {
        return mode;
      }
      if (key === 'schedule.timezone') {
        return 'Asia/Ho_Chi_Minh';
      }
      if (key === 'schedule.quoteHourlyCron') {
        return '0 * * * *';
      }
      if (key === 'schedule.dailyCompanyCron') {
        return '0 18 * * *';
      }
      if (key === 'simplize.reportTypes') {
        return [];
      }
      if (key === 'simplize.newsTypeIds') {
        return [];
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  const schedulerRegistry = {
    addCronJob: jest.fn(),
  } as unknown as SchedulerRegistry;

  const simplizeService = {
    getLatestQuote: jest.fn().mockResolvedValue({ price: 100, volume: '1000' }),
  } as unknown as SimplizeService;

  const intradayMarketJob = {
    runNow: jest.fn().mockResolvedValue({ status: 'triggered' }),
  };
  const dailyCompanyCompositeJob = {
    runNow: jest.fn().mockResolvedValue(undefined),
  };
  const eodDailyJob = {
    runNow: jest.fn().mockResolvedValue(undefined),
  };

  const service = new IngestionService(
    symbolsRepo,
    quoteDailyRepo,
    quoteIntradayRepo,
    {} as ForeignTradingDailyRepository,
    {} as InsiderTradingEventRepository,
    {} as StockRelatedPeerRepository,
    {} as CompanySubsidiaryRepository,
    {} as NewsArticleRepository,
    {} as CompanyReportRepository,
    simplizeService,
    crawlRunsRepo as unknown as CrawlRunsRepository,
    { name: 'MarketProvider', fetchSymbols: jest.fn(), fetchIntraday: jest.fn(), fetchQuoteHistory: jest.fn() } as any,
    configService,
    schedulerRegistry,
    intradayMarketJob as unknown as IntradayMarketJob,
    dailyCompanyCompositeJob as unknown as DailyCompanyCompositeJob,
    eodDailyJob as unknown as EodDailyJob,
  );

  return {
    service,
    intradayMarketJob,
    dailyCompanyCompositeJob,
    eodDailyJob,
    crawlRunsRepo,
  };
}

describe('IngestionService unified mode delegation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates quote-hourly to data-hub intraday job when unified.mode=datahub', async () => {
    const setup = createSetup('datahub');

    await setup.service.runQuoteHourly();

    expect(setup.intradayMarketJob.runNow).toHaveBeenCalledTimes(1);
    expect(setup.crawlRunsRepo.createRun).not.toHaveBeenCalled();
  });

  it('runs legacy quote-hourly flow when unified.mode=legacy', async () => {
    const setup = createSetup('legacy');

    await setup.service.runQuoteHourly();

    expect(setup.intradayMarketJob.runNow).not.toHaveBeenCalled();
    expect(setup.crawlRunsRepo.createRun).toHaveBeenCalledTimes(1);
    expect(setup.crawlRunsRepo.markSuccess).toHaveBeenCalledTimes(1);
  });

  it('handles quote-hourly skip status from intraday job in datahub mode', async () => {
    const setup = createSetup('datahub');
    setup.intradayMarketJob.runNow.mockResolvedValueOnce({
      status: 'skipped',
      reason: 'Not trading hours',
    });

    await expect(setup.service.runQuoteHourly()).resolves.toBeUndefined();
    expect(setup.intradayMarketJob.runNow).toHaveBeenCalledTimes(1);
  });

  it('delegates daily-company to composite job when unified.mode=datahub', async () => {
    const setup = createSetup('datahub');

    await setup.service.runDailyCompany();

    expect(setup.dailyCompanyCompositeJob.runNow).toHaveBeenCalledTimes(1);
    expect(setup.crawlRunsRepo.createRun).not.toHaveBeenCalled();
  });

  it('delegates daily-eod to eod job when unified.mode=datahub', async () => {
    const setup = createSetup('datahub');

    await setup.service.runDailyEOD();

    expect(setup.eodDailyJob.runNow).toHaveBeenCalledTimes(1);
    expect(setup.crawlRunsRepo.createRun).not.toHaveBeenCalled();
  });
});
