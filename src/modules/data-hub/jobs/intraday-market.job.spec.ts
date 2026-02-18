import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { IntradayMarketJob } from './intraday-market.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { QueueService } from '../../queue/queue.service';
import { Symbol, MarketIndex } from '../entities';

describe('IntradayMarketJob', () => {
  it('logs start/enqueued/dedup/completed events for dispatcher', async () => {
    const queueService = {
      addMarketIntradayStockJob: jest
        .fn()
        .mockResolvedValueOnce({ queueJobId: 'job-1', dedup: false })
        .mockResolvedValueOnce({ queueJobId: 'job-2', dedup: true }),
      addMarketIntradayIndexJob: jest.fn().mockResolvedValue({ queueJobId: 'idx-1', dedup: false }),
    } as unknown as QueueService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'schedule.timezone') {
          return 'Asia/Ho_Chi_Minh';
        }
        if (key === 'dataHub.intradayDispatchConcurrency') {
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
    } as unknown as Repository<Symbol>;

    const indexRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<MarketIndex>;

    const job = new IntradayMarketJob(
      {} as JobRunService,
      {} as AdvisoryLockService,
      {} as MarketHoursService,
      queueService,
      configService,
      symbolRepository,
      indexRepository,
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

    const processed = await (job as any).execute();

    expect(processed).toBe(1);
    expect(events).toEqual(
      expect.arrayContaining([
        'intraday_dispatch_started',
        'intraday_symbol_enqueued',
        'intraday_symbol_dedup_skipped',
        'intraday_dispatch_completed',
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
      addMarketIntradayStockJob: jest
        .fn()
        .mockImplementation(async (payload: { ticker: string }) => ({
          queueJobId: `job-${payload.ticker}`,
          dedup: false,
        })),
      addMarketIntradayIndexJob: jest.fn().mockResolvedValue({ queueJobId: 'idx-1', dedup: false }),
    } as unknown as QueueService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'schedule.timezone') {
          return 'Asia/Ho_Chi_Minh';
        }
        if (key === 'dataHub.intradayDispatchConcurrency') {
          return '20';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const symbolRepository = {
      find: jest.fn().mockResolvedValue(symbols),
    } as unknown as Repository<Symbol>;

    const indexRepository = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<MarketIndex>;

    const job = new IntradayMarketJob(
      {} as JobRunService,
      {} as AdvisoryLockService,
      {} as MarketHoursService,
      queueService,
      configService,
      symbolRepository,
      indexRepository,
    );

    const payloads: Array<Record<string, unknown>> = [];
    const logSpy = jest
      .spyOn((job as any).logger, 'log')
      .mockImplementation((...args: unknown[]) => {
        payloads.push(JSON.parse(String(args[0])));
      });
    const warnSpy = jest
      .spyOn((job as any).logger, 'warn')
      .mockImplementation(() => undefined);

    const processed = await (job as any).execute();
    expect(processed).toBe(220);

    const symbolEvents = payloads.filter(
      (entry) => entry.event === 'intraday_symbol_enqueued',
    );
    expect(symbolEvents).toHaveLength(220);

    const cycleId = String(symbolEvents[0].cycleId);
    expect(cycleId.startsWith('intraday:')).toBe(true);
    expect(symbolEvents.every((entry) => entry.cycleId === cycleId)).toBe(true);

    const completedEvent = payloads.find(
      (entry) => entry.event === 'intraday_dispatch_completed',
    );
    expect(completedEvent?.cycleId).toBe(cycleId);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
