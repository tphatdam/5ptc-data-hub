import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { TriggerOrchestratorProcessor } from '../../../../src/modules/market-ingestion/infrastructure/processors/trigger-orchestrator.processor';
import { TriggerRunService } from '../../../../src/modules/market-ingestion/application/services/trigger-run.service';
import { TriggerRunStatus } from '../../../../src/db/entities';
import { TRIGGER_ORCHESTRATOR_RUN_ALL_JOB } from '../../../../src/modules/queue/queue.constants';

describe('TriggerOrchestratorProcessor', () => {
  function createProcessor(overrides?: { newsFail?: boolean }) {
    let stepSequence = 0;
    const triggerRunService = {
      markRunStarted: jest.fn(async () => undefined),
      markRunCompleted: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      startStep: jest.fn(async (_runId: string, _sequence: number, _step: string) => {
        stepSequence += 1;
        return { id: `step-${stepSequence}` };
      }),
      finishStep: jest.fn(async () => undefined),
    } as unknown as TriggerRunService;

    const processor = new TriggerOrchestratorProcessor(
      triggerRunService,
      {
        get: jest.fn((key: string) => (key === 'unified.backfillBatchSize' ? 10 : undefined)),
      } as unknown as ConfigService,
      { runNow: jest.fn(async () => undefined) } as any,
      { runNow: jest.fn(async () => ({ status: 'triggered' })) } as any,
      { runNow: jest.fn(async () => undefined) } as any,
      { runNow: jest.fn(async () => undefined) } as any,
      {
        runNow: overrides?.newsFail
          ? jest.fn(async () => {
              throw new Error('news failed');
            })
          : jest.fn(async () => undefined),
      } as any,
      { runNow: jest.fn(async () => undefined) } as any,
      { runNow: jest.fn(async () => ({ status: 'triggered' })) } as any,
      { runNow: jest.fn(async () => undefined) } as any,
      { runNow: jest.fn(async () => undefined) } as any,
      { runNow: jest.fn(async () => undefined) } as any,
      {
        runBatch: jest
          .fn()
          .mockResolvedValueOnce({ taskName: 'symbols', processed: 100 })
          .mockResolvedValueOnce({ taskName: null, processed: 0 }),
      } as any,
    );

    return { processor, triggerRunService };
  }

  it('throws for unsupported orchestrator job name', async () => {
    const { processor } = createProcessor();
    await expect(
      processor.process({
        name: 'unsupported',
        data: { runId: 'run-1', mode: 'full' },
      } as Job<any>),
    ).rejects.toThrow('Unsupported orchestrator job');
  });

  it('continues on step failure and marks run as PARTIAL', async () => {
    const { processor, triggerRunService } = createProcessor({ newsFail: true });

    await processor.process({
      name: TRIGGER_ORCHESTRATOR_RUN_ALL_JOB,
      data: { runId: 'run-1', mode: 'full' },
    } as Job<any>);

    expect(triggerRunService.markRunStarted).toHaveBeenCalledWith('run-1');
    expect((triggerRunService.finishStep as jest.Mock).mock.calls.length).toBeGreaterThan(10);
    expect(triggerRunService.markRunCompleted).toHaveBeenCalledWith(
      'run-1',
      TriggerRunStatus.PARTIAL,
      expect.objectContaining({
        totalSteps: expect.any(Number),
      }),
    );
    expect(triggerRunService.markRunFailed).not.toHaveBeenCalled();
  });
});
