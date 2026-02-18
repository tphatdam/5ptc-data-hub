import { Job } from 'bullmq';
import { IntradayMarketProcessor } from './intraday-market.processor';
import { DynamicProviderAdapter } from '../providers/dynamic-provider.adapter';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { UpsertService } from '../services/upsert.service';
import { MARKET_INTRADAY_STOCK_JOB } from '../../queue/queue.constants';

describe('IntradayMarketProcessor', () => {
  it('logs expected event sequence for successful stock job', async () => {
    const providerAdapter = {
      invokeMarket: jest.fn().mockImplementation(
        async (
          _methodName: string,
          _args: unknown[],
          options: {
            hooks?: {
              onProviderTry?: (ctx: any) => void;
              onProviderFail?: (ctx: any) => void;
              onProviderSuccess?: (ctx: any) => void;
            };
          },
        ) => {
          options.hooks?.onProviderTry?.({ providerCode: 'VCI_API', attempt: 1 });
          options.hooks?.onProviderFail?.({
            providerCode: 'VCI_API',
            attempt: 1,
            error: 'timeout',
          });
          options.hooks?.onProviderTry?.({ providerCode: 'TCBS_API', attempt: 2 });
          options.hooks?.onProviderSuccess?.({
            providerCode: 'TCBS_API',
            attempt: 2,
            valueCount: 1,
          });
          return {
            providerCode: 'TCBS_API',
            value: [
              {
                ticker: 'AAA',
                ts: new Date('2026-02-18T02:15:00.000Z').toISOString(),
                open: 10,
                high: 11,
                low: 9,
                close: 10.5,
                volume: 1000,
                value: 10500,
              },
            ],
          };
        },
      ),
    } as unknown as DynamicProviderAdapter;
    const providerFactory = {
      getDataSourceByCode: jest.fn().mockResolvedValue({ id: 99 }),
    } as unknown as ProviderFactoryService;
    const upsertService = {
      upsertStockCandles: jest.fn().mockResolvedValue({
        inserted: 1,
        updated: 0,
        skipped: 0,
        processed: 1,
      }),
    } as unknown as UpsertService;

    const processor = new IntradayMarketProcessor(
      providerAdapter,
      providerFactory,
      upsertService,
    );
    const eventTrace: string[] = [];
    const logSpy = jest
      .spyOn((processor as any).logger, 'log')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        eventTrace.push(JSON.parse(message).event);
      });
    const warnSpy = jest
      .spyOn((processor as any).logger, 'warn')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        eventTrace.push(JSON.parse(message).event);
      });

    const processed = await processor.process({
      id: 'q-100',
      name: MARKET_INTRADAY_STOCK_JOB,
      data: {
        cycleId: 'intraday:2026-02-18T09:15:00+07:00',
        timeBucket: '2026-02-18T09:15:00+07:00',
        symbolId: 10,
        ticker: 'AAA',
        from: new Date('2026-02-18T02:00:00.000Z').toISOString(),
        to: new Date('2026-02-18T02:30:00.000Z').toISOString(),
      },
      attemptsMade: 0,
    } as unknown as Job);

    expect(processed).toBe(1);
    expect(eventTrace).toEqual([
      'intraday_worker_started',
      'provider_attempt_started',
      'provider_attempt_failed',
      'provider_attempt_started',
      'provider_attempt_succeeded',
      'intraday_transform_completed',
      'intraday_upsert_completed',
    ]);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('logs worker failed event when provider throws', async () => {
    const providerAdapter = {
      invokeMarket: jest.fn().mockRejectedValue(new Error('provider down')),
    } as unknown as DynamicProviderAdapter;
    const providerFactory = {} as ProviderFactoryService;
    const upsertService = {} as UpsertService;

    const processor = new IntradayMarketProcessor(
      providerAdapter,
      providerFactory,
      upsertService,
    );

    const errorEvents: string[] = [];
    const errorSpy = jest
      .spyOn((processor as any).logger, 'error')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        errorEvents.push(JSON.parse(message).event);
      });

    await expect(
      processor.process({
        id: 'q-101',
        name: MARKET_INTRADAY_STOCK_JOB,
        data: {
          cycleId: 'intraday:2026-02-18T09:15:00+07:00',
          timeBucket: '2026-02-18T09:15:00+07:00',
          symbolId: 11,
          ticker: 'BBB',
          from: new Date('2026-02-18T02:00:00.000Z').toISOString(),
          to: new Date('2026-02-18T02:30:00.000Z').toISOString(),
        },
        attemptsMade: 2,
      } as unknown as Job),
    ).rejects.toThrow('provider down');

    expect(errorEvents).toContain('intraday_worker_failed');
    errorSpy.mockRestore();
  });
});
