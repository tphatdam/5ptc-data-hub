import { Test } from '@nestjs/testing';
import { RunAllTriggersUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/run-all-triggers.use-case';
import { MARKET_INGESTION_PORT } from '../../../../src/modules/market-ingestion/domain/ports/tokens';

describe('RunAllTriggersUseCase', () => {
  const marketIngestionPort = {
    runQuoteHourly: jest.fn(async () => undefined),
    runDailyCompany: jest.fn(async () => undefined),
    runDailyEod: jest.fn(async () => undefined),
    runAllTriggers: jest.fn(async () => ({
      runId: 'run-123',
      acceptedAt: new Date('2026-02-21T00:00:00.000Z').toISOString(),
      mode: 'full' as const,
    })),
    getTriggerRunStatus: jest.fn(async () => ({
      runId: 'run-123',
      status: 'QUEUED',
      startedAt: null,
      finishedAt: null,
      summary: { totalSteps: 0, success: 0, failed: 0, skipped: 0 },
      steps: [],
    })),
  };

  let useCase: RunAllTriggersUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RunAllTriggersUseCase,
        { provide: MARKET_INGESTION_PORT, useValue: marketIngestionPort },
      ],
    }).compile();

    useCase = moduleRef.get(RunAllTriggersUseCase);
  });

  it('enqueues run-all through market ingestion port', async () => {
    const result = await useCase.execute();
    expect(marketIngestionPort.runAllTriggers).toHaveBeenCalledTimes(1);
    expect(result.runId).toBe('run-123');
    expect(result.mode).toBe('full');
  });
});
