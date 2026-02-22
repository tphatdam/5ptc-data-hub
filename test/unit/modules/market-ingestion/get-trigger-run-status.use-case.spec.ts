import { Test } from '@nestjs/testing';
import { GetTriggerRunStatusUseCase } from '../../../../src/modules/market-ingestion/application/use-cases/get-trigger-run-status.use-case';
import { MARKET_INGESTION_PORT } from '../../../../src/modules/market-ingestion/domain/ports/tokens';

describe('GetTriggerRunStatusUseCase', () => {
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
      status: 'RUNNING',
      startedAt: new Date('2026-02-21T00:00:00.000Z').toISOString(),
      finishedAt: null,
      summary: { totalSteps: 1, success: 0, failed: 0, skipped: 0 },
      steps: [
        {
          step: 'symbol-sync',
          status: 'RUNNING',
          startedAt: new Date('2026-02-21T00:00:00.000Z').toISOString(),
          finishedAt: null,
          error: null,
        },
      ],
    })),
  };

  let useCase: GetTriggerRunStatusUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetTriggerRunStatusUseCase,
        { provide: MARKET_INGESTION_PORT, useValue: marketIngestionPort },
      ],
    }).compile();

    useCase = moduleRef.get(GetTriggerRunStatusUseCase);
  });

  it('returns trigger run status through market ingestion port', async () => {
    const result = await useCase.execute('run-123');
    expect(marketIngestionPort.getTriggerRunStatus).toHaveBeenCalledWith('run-123');
    expect(result.status).toBe('RUNNING');
    expect(result.steps).toHaveLength(1);
  });
});
