import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TriggerController } from '../src/trigger/trigger.controller';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { InternalApiKeyGuard } from '../src/common/guards/internal-api-key.guard';
import {
  EodDailyJob,
  FundamentalsJob,
  GapFillJob,
  GoldJob,
  IntradayMarketJob,
  NewsJob,
  SymbolSyncJob,
} from '../src/data-hub/jobs';

describe('TriggerController', () => {
  const ingestionService = {
    runQuoteHourly: jest.fn(async () => undefined),
    runDailyCompany: jest.fn(async () => undefined),
  };

  const intradayMarketJob = { handleCron: jest.fn(async () => undefined) };
  const eodDailyJob = { handleCron: jest.fn(async () => undefined) };
  const fundamentalsJob = { handleCron: jest.fn(async () => undefined) };
  const goldJob = { handleCron: jest.fn(async () => undefined) };
  const newsJob = { handleCron: jest.fn(async () => undefined) };
  const symbolSyncJob = { handleCron: jest.fn(async () => undefined) };
  const gapFillJob = { handleCron: jest.fn(async () => undefined) };
  const configService = { get: jest.fn(() => 'test') };

  let controller: TriggerController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TriggerController],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: IngestionService, useValue: ingestionService },
        { provide: IntradayMarketJob, useValue: intradayMarketJob },
        { provide: EodDailyJob, useValue: eodDailyJob },
        { provide: FundamentalsJob, useValue: fundamentalsJob },
        { provide: GoldJob, useValue: goldJob },
        { provide: NewsJob, useValue: newsJob },
        { provide: SymbolSyncJob, useValue: symbolSyncJob },
        { provide: GapFillJob, useValue: gapFillJob },
        InternalApiKeyGuard,
      ],
    }).compile();

    controller = moduleRef.get(TriggerController);
  });

  it('lists triggers', () => {
    const result = controller.listTriggers();
    expect(Array.isArray(result.triggers)).toBe(true);
    expect(result.triggers).toHaveLength(9);
  });

  it('triggers ingestion quote-hourly', async () => {
    await controller.triggerQuoteHourly();
    expect(ingestionService.runQuoteHourly).toHaveBeenCalledTimes(1);
  });

  it('triggers ingestion daily-company', async () => {
    await controller.triggerDailyCompany();
    expect(ingestionService.runDailyCompany).toHaveBeenCalledTimes(1);
  });

  it('triggers data-hub jobs', async () => {
    await controller.triggerIntradayMarket();
    await controller.triggerEodDaily();
    await controller.triggerFundamentals();
    await controller.triggerGold();
    await controller.triggerNews();
    await controller.triggerSymbolSync();
    await controller.triggerGapFill();

    expect(intradayMarketJob.handleCron).toHaveBeenCalledTimes(1);
    expect(eodDailyJob.handleCron).toHaveBeenCalledTimes(1);
    expect(fundamentalsJob.handleCron).toHaveBeenCalledTimes(1);
    expect(goldJob.handleCron).toHaveBeenCalledTimes(1);
    expect(newsJob.handleCron).toHaveBeenCalledTimes(1);
    expect(symbolSyncJob.handleCron).toHaveBeenCalledTimes(1);
    expect(gapFillJob.handleCron).toHaveBeenCalledTimes(1);
  });
});
