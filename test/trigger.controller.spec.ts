import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MarketTriggersController } from '../src/modules/market-ingestion/presentation/controllers/market-triggers.controller';
import { RunQuoteHourlyUseCase } from '../src/modules/market-ingestion/application/use-cases/run-quote-hourly.use-case';
import { RunDailyCompanyUseCase } from '../src/modules/market-ingestion/application/use-cases/run-daily-company.use-case';
import { RunDailyEodUseCase } from '../src/modules/market-ingestion/application/use-cases/run-daily-eod.use-case';
import { RunAllTriggersUseCase } from '../src/modules/market-ingestion/application/use-cases/run-all-triggers.use-case';
import { GetTriggerRunStatusUseCase } from '../src/modules/market-ingestion/application/use-cases/get-trigger-run-status.use-case';
import { InternalApiKeyGuard } from '../src/common/guards/internal-api-key.guard';

describe('MarketTriggersController', () => {
  const runQuoteHourlyUseCase = { execute: jest.fn(async () => undefined) };
  const runDailyCompanyUseCase = { execute: jest.fn(async () => undefined) };
  const runDailyEodUseCase = { execute: jest.fn(async () => undefined) };
  const runAllTriggersUseCase = {
    execute: jest.fn(async () => ({
      runId: 'run-123',
      acceptedAt: new Date('2026-02-21T00:00:00.000Z').toISOString(),
      mode: 'full' as const,
    })),
  };
  const getTriggerRunStatusUseCase = {
    execute: jest.fn(async () => ({
      runId: 'run-123',
      status: 'RUNNING',
      startedAt: new Date('2026-02-21T00:00:00.000Z').toISOString(),
      finishedAt: null,
      summary: { totalSteps: 1, success: 0, failed: 0, skipped: 0 },
      steps: [],
    })),
  };

  let controller: MarketTriggersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
      controllers: [MarketTriggersController],
      providers: [
        { provide: RunQuoteHourlyUseCase, useValue: runQuoteHourlyUseCase },
        { provide: RunDailyCompanyUseCase, useValue: runDailyCompanyUseCase },
        { provide: RunDailyEodUseCase, useValue: runDailyEodUseCase },
        { provide: RunAllTriggersUseCase, useValue: runAllTriggersUseCase },
        { provide: GetTriggerRunStatusUseCase, useValue: getTriggerRunStatusUseCase },
        InternalApiKeyGuard,
      ],
    }).compile();

    controller = moduleRef.get(MarketTriggersController);
  });

  it('lists triggers', () => {
    const res = { setHeader: jest.fn() } as any;
    const result = controller.listTriggers(res);

    expect(Array.isArray(result.triggers)).toBe(true);
    expect(result.triggers).toHaveLength(5);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('triggers quote-hourly', async () => {
    const res = { setHeader: jest.fn() } as any;

    await controller.triggerQuoteHourly(res);

    expect(runQuoteHourlyUseCase.execute).toHaveBeenCalledTimes(1);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('triggers daily-company', async () => {
    const res = { setHeader: jest.fn() } as any;

    await controller.triggerDailyCompany(res);

    expect(runDailyCompanyUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
