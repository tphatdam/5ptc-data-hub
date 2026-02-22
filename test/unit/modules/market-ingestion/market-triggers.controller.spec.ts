import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalApiKeyGuard } from '../../../../src/common/guards/internal-api-key.guard';
import { MarketTriggersController } from '../../../../src/modules/market-ingestion/presentation/controllers/market-triggers.controller';
import { RunQuoteHourlyUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-quote-hourly.use-case';
import { RunDailyCompanyUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-daily-company.use-case';
import { RunDailyEodUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-daily-eod.use-case';
import { RunAllTriggersUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-all-triggers.use-case';
import { GetTriggerRunStatusUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/get-trigger-run-status.use-case';

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
      controllers: [MarketTriggersController],
      providers: [
        { provide: RunQuoteHourlyUseCase, useValue: runQuoteHourlyUseCase },
        { provide: RunDailyCompanyUseCase, useValue: runDailyCompanyUseCase },
        { provide: RunDailyEodUseCase, useValue: runDailyEodUseCase },
        { provide: RunAllTriggersUseCase, useValue: runAllTriggersUseCase },
        { provide: GetTriggerRunStatusUseCase, useValue: getTriggerRunStatusUseCase },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'test-internal-key') } },
        { provide: InternalApiKeyGuard, useValue: { canActivate: jest.fn(() => true) } },
      ],
    }).compile();

    controller = moduleRef.get(MarketTriggersController);
  });

  it('lists unified trigger endpoints', () => {
    const res = { setHeader: jest.fn() } as any;
    const result = controller.listTriggers(res);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(result.triggers).toEqual(
      expect.arrayContaining([{ method: 'POST', path: '/triggers/quote-hourly' }]),
    );
    expect(result.triggers).toEqual(
      expect.arrayContaining([{ method: 'POST', path: '/triggers/run-all' }]),
    );
    expect(result.triggers).toHaveLength(5);
  });

  it('forwards quote-hourly to use case', async () => {
    const res = { setHeader: jest.fn() } as any;
    await controller.triggerQuoteHourly(res);

    expect(runQuoteHourlyUseCase.execute).toHaveBeenCalledTimes(1);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('forwards daily-company to use case', async () => {
    const res = { setHeader: jest.fn() } as any;
    await controller.triggerDailyCompany(res);

    expect(runDailyCompanyUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('forwards daily-eod to use case', async () => {
    const res = { setHeader: jest.fn() } as any;
    await controller.triggerDailyEod(res);

    expect(runDailyEodUseCase.execute).toHaveBeenCalledTimes(1);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('enqueues run-all trigger', async () => {
    const res = { setHeader: jest.fn() } as any;
    const result = await controller.triggerRunAll(res);

    expect(runAllTriggersUseCase.execute).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('QUEUED');
    expect(result.runId).toBe('run-123');
  });

  it('returns run status', async () => {
    const res = { setHeader: jest.fn() } as any;
    const result = await controller.getRunStatus('run-123', res);

    expect(getTriggerRunStatusUseCase.execute).toHaveBeenCalledWith('run-123');
    expect(result.ok).toBe(true);
    expect(result.status).toBe('RUNNING');
  });
});
