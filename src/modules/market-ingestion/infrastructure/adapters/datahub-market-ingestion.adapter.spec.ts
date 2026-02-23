import { DataHubMarketIngestionAdapter } from './datahub-market-ingestion.adapter';

describe('DataHubMarketIngestionAdapter', () => {
  it('delegates trigger methods to data-hub jobs and orchestrator service', async () => {
    const intradayMarketJob = {
      runNow: jest.fn().mockResolvedValue({ status: 'triggered' }),
    };
    const dailyCompanyCompositeJob = {
      runNow: jest.fn().mockResolvedValue(undefined),
    };
    const eodDailyJob = {
      runNow: jest.fn().mockResolvedValue(undefined),
    };
    const triggerOrchestratorService = {
      enqueueRunAll: jest.fn().mockResolvedValue({
        runId: 'run-1',
        acceptedAt: '2026-02-23T00:00:00.000Z',
        mode: 'full',
      }),
      getRunStatus: jest.fn().mockResolvedValue({
        runId: 'run-1',
        status: 'RUNNING',
        startedAt: null,
        finishedAt: null,
        summary: { totalSteps: 0, success: 0, failed: 0, skipped: 0 },
        steps: [],
      }),
    };

    const adapter = new DataHubMarketIngestionAdapter(
      intradayMarketJob as any,
      dailyCompanyCompositeJob as any,
      eodDailyJob as any,
      triggerOrchestratorService as any,
    );

    await adapter.runQuoteHourly();
    await adapter.runDailyCompany();
    await adapter.runDailyEod();
    const runAllResult = await adapter.runAllTriggers();
    const statusResult = await adapter.getTriggerRunStatus('run-1');

    expect(intradayMarketJob.runNow).toHaveBeenCalledTimes(1);
    expect(dailyCompanyCompositeJob.runNow).toHaveBeenCalledTimes(1);
    expect(eodDailyJob.runNow).toHaveBeenCalledTimes(1);
    expect(triggerOrchestratorService.enqueueRunAll).toHaveBeenCalledTimes(1);
    expect(triggerOrchestratorService.getRunStatus).toHaveBeenCalledWith('run-1');
    expect(runAllResult.mode).toBe('full');
    expect(statusResult.runId).toBe('run-1');
  });
});
