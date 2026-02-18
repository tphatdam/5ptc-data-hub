import { Test } from '@nestjs/testing';
import { MarketTriggersV1CompatController } from '../../../../src/modules/market-ingestion/presentation/controllers/market-triggers-v1-compat.controller';
import { RunQuoteHourlyUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-quote-hourly.use-case';
import { RunDailyCompanyUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-daily-company.use-case';

describe('MarketTriggersV1CompatController', () => {
  const runQuoteHourlyUseCase = { execute: jest.fn(async () => undefined) };
  const runDailyCompanyUseCase = { execute: jest.fn(async () => undefined) };

  let controller: MarketTriggersV1CompatController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [MarketTriggersV1CompatController],
      providers: [
        { provide: RunQuoteHourlyUseCase, useValue: runQuoteHourlyUseCase },
        { provide: RunDailyCompanyUseCase, useValue: runDailyCompanyUseCase },
      ],
    }).compile();

    controller = moduleRef.get(MarketTriggersV1CompatController);
  });

  it('sets deprecation headers and lists compatibility triggers', () => {
    const res = { setHeader: jest.fn() } as any;
    const result = controller.listTriggers(res);

    expect(res.setHeader).toHaveBeenCalledWith('x-api-deprecated', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('sunset', '2026-08-31');
    expect(result.triggers).toEqual(
      expect.arrayContaining([{ method: 'POST', path: '/triggers/ingestion/quote-hourly' }]),
    );
  });

  it('forwards quote-hourly to use case', async () => {
    const res = { setHeader: jest.fn() } as any;
    await controller.triggerQuoteHourly(res);

    expect(runQuoteHourlyUseCase.execute).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('sunset', '2026-08-31');
  });

  it('forwards daily-company to use case', async () => {
    const res = { setHeader: jest.fn() } as any;
    await controller.triggerDailyCompany(res);

    expect(runDailyCompanyUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
