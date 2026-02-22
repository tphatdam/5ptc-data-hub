import { Queue } from 'bullmq';
import { COMPANY_INTEL_FOREIGN_JOB, COMPANY_INTEL_QUEUE } from './queue.constants';
import { QueueService } from './queue.service';

function createQueueMock(name: string): {
  name: string;
  add: jest.Mock;
  getJob: jest.Mock;
} {
  return {
    name,
    add: jest.fn(),
    getJob: jest.fn(),
  };
}

describe('QueueService', () => {
  function createService(companyQueueOverrides?: Partial<ReturnType<typeof createQueueMock>>) {
    const reportQueue = createQueueMock('reportQueue');
    const emailQueue = createQueueMock('emailQueue');
    const seedQueue = createQueueMock('seedQueue');
    const marketQueue = createQueueMock('marketIntradayQueue');
    const companyQueue = {
      ...createQueueMock(COMPANY_INTEL_QUEUE),
      ...(companyQueueOverrides || {}),
    };

    const service = new QueueService(
      reportQueue as unknown as Queue,
      emailQueue as unknown as Queue,
      seedQueue as unknown as Queue,
      marketQueue as unknown as Queue,
      companyQueue as unknown as Queue,
      createQueueMock('triggerOrchestratorQueue') as unknown as Queue,
    );

    return { service, companyQueue };
  }

  it('returns dedup=true and logs dedup when existing job is found before add', async () => {
    const { service, companyQueue } = createService();
    companyQueue.getJob.mockResolvedValue({ id: 'existing-1' });

    const logEvents: string[] = [];
    const logSpy = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation((...args: unknown[]) => {
        logEvents.push(JSON.parse(String(args[0])).event);
      });
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation((...args: unknown[]) => {
        logEvents.push(JSON.parse(String(args[0])).event);
      });

    const result = await service.addCompanyIntelForeignJob({
      cycleId: 'company-intel:intraday_refresh:2026-02-18T09:30:00+07:00',
      timeBucket: '2026-02-18T09:30:00+07:00',
      symbolId: 10,
      ticker: 'AAA',
      from: new Date('2026-02-18T02:00:00.000Z').toISOString(),
      to: new Date('2026-02-18T02:30:00.000Z').toISOString(),
      jobType: 'foreign',
      attempt: 1,
    });

    expect(result).toEqual({ queueJobId: 'existing-1', dedup: true });
    expect(companyQueue.add).not.toHaveBeenCalled();
    expect(logEvents).toEqual(expect.arrayContaining(['queue_add_started', 'queue_dedup_hit']));

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('returns dedup=true when add throws duplicate job error (race-safe)', async () => {
    const { service, companyQueue } = createService();
    companyQueue.getJob.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'existing-2' });
    companyQueue.add.mockRejectedValue(new Error('Job company:intel:foreign:abc already exists'));

    const warnEvents: string[] = [];
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation((...args: unknown[]) => {
        warnEvents.push(JSON.parse(String(args[0])).event);
      });

    const result = await service.addCompanyIntelForeignJob({
      cycleId: 'company-intel:intraday_refresh:2026-02-18T09:30:00+07:00',
      timeBucket: '2026-02-18T09:30:00+07:00',
      symbolId: 11,
      ticker: 'BBB',
      from: new Date('2026-02-18T02:00:00.000Z').toISOString(),
      to: new Date('2026-02-18T02:30:00.000Z').toISOString(),
      jobType: 'foreign',
      attempt: 1,
    });

    expect(result.dedup).toBe(true);
    expect(result.queueJobId).toBe('existing-2');
    expect(warnEvents).toContain('queue_dedup_hit');

    warnSpy.mockRestore();
  });

  it('throws and logs queue_add_failed for non-dedup errors in generic addJob', async () => {
    const { service, companyQueue } = createService();
    companyQueue.getJob.mockResolvedValue(null);
    companyQueue.add.mockRejectedValue(new Error('redis unavailable'));

    const errorEvents: string[] = [];
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation((...args: unknown[]) => {
        errorEvents.push(JSON.parse(String(args[0])).event);
      });

    await expect(
      service.addJob(
        COMPANY_INTEL_QUEUE,
        COMPANY_INTEL_FOREIGN_JOB,
        { ticker: 'CCC' },
        { jobId: 'company:intel:foreign:test' },
      ),
    ).rejects.toThrow('redis unavailable');

    expect(errorEvents).toContain('queue_add_failed');
    errorSpy.mockRestore();
  });
});
