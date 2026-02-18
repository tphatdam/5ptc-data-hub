import { Test } from '@nestjs/testing';
import { TriggerController } from '../src/trigger/trigger.controller';
import { RunQuoteHourlyUseCase } from '../src/modules/market-ingestion/application/use-cases/run-quote-hourly.use-case';
import { RunDailyCompanyUseCase } from '../src/modules/market-ingestion/application/use-cases/run-daily-company.use-case';
import { InternalApiKeyGuard } from '../src/common/guards/internal-api-key.guard';

describe('TriggerController', () => {
  const runQuoteHourlyUseCase = { execute: jest.fn(async () => undefined) };
  const runDailyCompanyUseCase = { execute: jest.fn(async () => undefined) };

  let controller: TriggerController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TriggerController],
      providers: [
        { provide: RunQuoteHourlyUseCase, useValue: runQuoteHourlyUseCase },
        { provide: RunDailyCompanyUseCase, useValue: runDailyCompanyUseCase },
        InternalApiKeyGuard,
      ],
    }).compile();

    controller = moduleRef.get(TriggerController);
  });

  it('lists triggers', () => {
    const res = { setHeader: jest.fn() } as any;
    const result = controller.listTriggers(res);

    expect(Array.isArray(result.triggers)).toBe(true);
    expect(result.triggers).toHaveLength(2);
    expect(res.setHeader).toHaveBeenCalledWith('x-api-deprecated', 'true');
  });

  it('triggers ingestion quote-hourly', async () => {
    const res = { setHeader: jest.fn() } as any;

    await controller.triggerQuoteHourly(res);

    expect(runQuoteHourlyUseCase.execute).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('sunset', '2026-08-31');
  });

  it('triggers ingestion daily-company', async () => {
    const res = { setHeader: jest.fn() } as any;

    await controller.triggerDailyCompany(res);

    expect(runDailyCompanyUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
