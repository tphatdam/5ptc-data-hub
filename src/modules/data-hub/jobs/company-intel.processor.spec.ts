import { Job } from 'bullmq';
import { CompanyIntelProcessor } from './company-intel.processor';
import { DynamicProviderAdapter } from '../providers/dynamic-provider.adapter';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { UpsertService } from '../services/upsert.service';
import { COMPANY_INTEL_FOREIGN_JOB, COMPANY_INTEL_INSIDER_JOB } from '../../queue/queue.constants';

describe('CompanyIntelProcessor', () => {
  it('logs expected event sequence for successful foreign job', async () => {
    const providerAdapter = {
      invokeCompanyIntel: jest.fn().mockImplementation(
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
          options.hooks?.onProviderTry?.({ providerCode: 'SIMPLIZE_API', attempt: 2 });
          options.hooks?.onProviderSuccess?.({
            providerCode: 'SIMPLIZE_API',
            attempt: 2,
            valueCount: 1,
          });

          return {
            providerCode: 'SIMPLIZE_API',
            value: [
              {
                ticker: 'AAA',
                tradeDate: '2026-02-18',
                buyVolume: 1000,
                sellVolume: 400,
                netVolume: 600,
                buyValue: 10000,
                sellValue: 4000,
                netValue: 6000,
                rawPayload: { source: 'test' },
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
      upsertStockForeignTradingDaily: jest.fn().mockResolvedValue({
        inserted: 1,
        updated: 0,
        skipped: 0,
        processed: 1,
      }),
    } as unknown as UpsertService;

    const processor = new CompanyIntelProcessor(providerAdapter, providerFactory, upsertService);
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
      id: 'q-ci-1',
      name: COMPANY_INTEL_FOREIGN_JOB,
      data: {
        cycleId: 'company-intel:intraday_refresh:2026-02-18T09:30:00+07:00',
        timeBucket: '2026-02-18T09:30:00+07:00',
        symbolId: 10,
        ticker: 'AAA',
        from: new Date('2026-02-18T02:00:00.000Z').toISOString(),
        to: new Date('2026-02-18T02:30:00.000Z').toISOString(),
        jobType: 'foreign',
        attempt: 1,
      },
      attemptsMade: 0,
    } as unknown as Job);

    expect(processed).toBe(1);
    expect(eventTrace).toEqual([
      'company_intel_worker_started',
      'foreign_fetch_started',
      'provider_attempt_started',
      'provider_attempt_failed',
      'provider_attempt_started',
      'provider_attempt_succeeded',
      'foreign_fetch_completed',
      'foreign_upsert_completed',
    ]);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('logs worker failed event when provider throws for insider flow', async () => {
    const providerAdapter = {
      invokeCompanyIntel: jest.fn().mockRejectedValue(new Error('provider down')),
    } as unknown as DynamicProviderAdapter;
    const providerFactory = {} as ProviderFactoryService;
    const upsertService = {} as UpsertService;

    const processor = new CompanyIntelProcessor(providerAdapter, providerFactory, upsertService);

    const errorEvents: string[] = [];
    const errorSpy = jest
      .spyOn((processor as any).logger, 'error')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        errorEvents.push(JSON.parse(message).event);
      });

    await expect(
      processor.process({
        id: 'q-ci-2',
        name: COMPANY_INTEL_INSIDER_JOB,
        data: {
          cycleId: 'company-intel:nightly_reconciliation:2026-02-18T20:10:00+07:00',
          timeBucket: '2026-02-18T20:10:00+07:00',
          symbolId: 11,
          ticker: 'BBB',
          from: new Date('2026-02-11T13:10:00.000Z').toISOString(),
          to: new Date('2026-02-18T13:10:00.000Z').toISOString(),
          jobType: 'insider',
          attempt: 1,
        },
        attemptsMade: 2,
      } as unknown as Job),
    ).rejects.toThrow('provider down');

    expect(errorEvents).toContain('company_intel_worker_failed');
    errorSpy.mockRestore();
  });
});
