import { DynamicProviderAdapter } from './dynamic-provider.adapter';
import { ProviderFactoryService } from './provider-factory.service';

describe('DynamicProviderAdapter', () => {
  it('logs fallback flow when provider A fails and provider B succeeds', async () => {
    const failingProvider = {
      code: 'VCI_API',
      fetchIntradayCandles15m: jest
        .fn()
        .mockRejectedValue(new Error('timeout from VCI')),
    };
    const succeedingProvider = {
      code: 'TCBS_API',
      fetchIntradayCandles15m: jest.fn().mockResolvedValue([
        {
          ticker: 'AAA',
          interval: 'INTRADAY_15M',
          ts: new Date('2026-02-18T02:15:00.000Z').toISOString(),
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 1000,
        },
      ]),
    };

    const providerFactory = {
      getMarketProviderEntries: jest.fn().mockResolvedValue([
        { code: 'VCI_API', provider: failingProvider },
        { code: 'TCBS_API', provider: succeedingProvider },
      ]),
    } as unknown as ProviderFactoryService;

    const adapter = new DynamicProviderAdapter(providerFactory);
    const logEvents: string[] = [];
    const logSpy = jest
      .spyOn((adapter as any).logger, 'log')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        logEvents.push(JSON.parse(message).event);
      });
    const warnSpy = jest
      .spyOn((adapter as any).logger, 'warn')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        logEvents.push(JSON.parse(message).event);
      });

    const result = await adapter.invokeMarket(
      'fetchIntradayCandles15m',
      [['AAA'], new Date('2026-02-18T02:00:00.000Z'), new Date('2026-02-18T02:30:00.000Z')],
      {
        logContext: {
          module: 'test.dynamic-provider',
          jobName: 'IntradayMarketJob',
          cycleId: 'intraday:2026-02-18T09:15:00+07:00',
        },
      },
    );

    expect(result.providerCode).toBe('TCBS_API');
    expect(logEvents).toEqual(
      expect.arrayContaining([
        'fallback_chain_start',
        'fallback_provider_try',
        'fallback_provider_fail',
        'fallback_provider_success',
      ]),
    );

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
