import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { CompanyIntelJob } from './company-intel.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { QueueService } from '../../queue/queue.service';
import { Symbol as SymbolEntity } from '../entities';

describe('CompanyIntelJob', () => {
  it('logs start/enqueued/dedup/completed events for dispatcher', async () => {
    const queueService = {
      addCompanyIntelForeignJob: jest
        .fn()
        .mockResolvedValueOnce({ queueJobId: 'foreign-1', dedup: false })
        .mockResolvedValueOnce({ queueJobId: 'foreign-2', dedup: true }),
      addCompanyIntelInsiderJob: jest
        .fn()
        .mockResolvedValue({ queueJobId: 'insider-1', dedup: false }),
    } as unknown as QueueService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'schedule.timezone') {
          return 'Asia/Ho_Chi_Minh';
        }
        if (key === 'dataHub.companyIntelDispatchConcurrency') {
          return '1';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const symbolRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 10, ticker: 'AAA', isActive: true },
        { id: 11, ticker: 'BBB', isActive: true },
      ]),
    } as unknown as Repository<SymbolEntity>;

    const job = new CompanyIntelJob(
      {} as JobRunService,
      {} as AdvisoryLockService,
      {} as MarketHoursService,
      queueService,
      configService,
      symbolRepository,
    );

    const events: string[] = [];
    const logSpy = jest
      .spyOn((job as any).logger, 'log')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        events.push(JSON.parse(message).event);
      });
    const warnSpy = jest
      .spyOn((job as any).logger, 'warn')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        events.push(JSON.parse(message).event);
      });

    const processed = await (job as any).execute('intraday_refresh');
    expect(processed).toBe(3);
    expect(events).toEqual(
      expect.arrayContaining([
        'company_intel_dispatch_started',
        'company_intel_symbol_enqueued',
        'company_intel_symbol_dedup_skipped',
        'company_intel_dispatch_completed',
      ]),
    );

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('keeps cycleId consistent across 200+ symbol dispatch events', async () => {
    const symbols = Array.from({ length: 220 }, (_, index) => ({
      id: index + 1,
      ticker: `S${String(index + 1).padStart(4, '0')}`,
      isActive: true,
    }));

    const queueService = {
      addCompanyIntelForeignJob: jest
        .fn()
        .mockImplementation(async (payload: { ticker: string }) => ({
          queueJobId: `foreign-${payload.ticker}`,
          dedup: false,
        })),
      addCompanyIntelInsiderJob: jest
        .fn()
        .mockImplementation(async (payload: { ticker: string }) => ({
          queueJobId: `insider-${payload.ticker}`,
          dedup: false,
        })),
    } as unknown as QueueService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'schedule.timezone') {
          return 'Asia/Ho_Chi_Minh';
        }
        if (key === 'dataHub.companyIntelDispatchConcurrency') {
          return '25';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const symbolRepository = {
      find: jest.fn().mockResolvedValue(symbols),
    } as unknown as Repository<SymbolEntity>;

    const job = new CompanyIntelJob(
      {} as JobRunService,
      {} as AdvisoryLockService,
      {} as MarketHoursService,
      queueService,
      configService,
      symbolRepository,
    );

    const payloads: Array<Record<string, unknown>> = [];
    const logSpy = jest
      .spyOn((job as any).logger, 'log')
      .mockImplementation((...args: unknown[]) => {
        payloads.push(JSON.parse(String(args[0])));
      });
    const warnSpy = jest.spyOn((job as any).logger, 'warn').mockImplementation(() => undefined);

    const processed = await (job as any).execute('intraday_refresh');
    expect(processed).toBe(440);

    const symbolEvents = payloads.filter(
      (entry) => entry.event === 'company_intel_symbol_enqueued',
    );
    expect(symbolEvents).toHaveLength(440);

    const cycleId = String(symbolEvents[0].cycleId);
    expect(cycleId.startsWith('company-intel:')).toBe(true);
    expect(symbolEvents.every((entry) => entry.cycleId === cycleId)).toBe(true);

    const completedEvent = payloads.find(
      (entry) => entry.event === 'company_intel_dispatch_completed',
    );
    expect(completedEvent?.cycleId).toBe(cycleId);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
