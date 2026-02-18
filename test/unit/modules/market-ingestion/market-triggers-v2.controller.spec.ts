import { Test } from '@nestjs/testing';
import { MarketTriggersV2Controller } from '../../../../src/modules/market-ingestion/presentation/controllers/market-triggers-v2.controller';
import { RunQuoteHourlyUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-quote-hourly.use-case';
import { RunDailyCompanyUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-daily-company.use-case';

describe('MarketTriggersV2Controller', () => {
  const runQuoteHourlyUseCase = { execute: jest.fn(async () => undefined) };
  const runDailyCompanyUseCase = { execute: jest.fn(async () => undefined) };

  let controller: MarketTriggersV2Controller;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [MarketTriggersV2Controller],
      providers: [
        { provide: RunQuoteHourlyUseCase, useValue: runQuoteHourlyUseCase },
        { provide: RunDailyCompanyUseCase, useValue: runDailyCompanyUseCase },
      ],
    }).compile();

    controller = moduleRef.get(MarketTriggersV2Controller);
  });

  it('runs quote-hourly trigger', async () => {
    const result = await controller.triggerQuoteHourly();
    expect(runQuoteHourlyUseCase.execute).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.job).toBe('quote-hourly');
  });

  it('runs daily-company trigger', async () => {
    const result = await controller.triggerDailyCompany();
    expect(runDailyCompanyUseCase.execute).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.job).toBe('daily-company');
  });
});
