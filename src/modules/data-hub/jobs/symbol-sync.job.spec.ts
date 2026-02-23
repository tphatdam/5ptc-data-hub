import { Repository } from 'typeorm';
import { SymbolSyncJob } from './symbol-sync.job';
import { Symbol, Exchange } from '../entities';

describe('SymbolSyncJob', () => {
  function createJob() {
    const providerAdapter = {
      invokeSymbolList: jest.fn(),
    };
    const providerFactory = {
      getSymbolListProviderEntries: jest.fn(),
    };

    const symbolRepository = {
      find: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    const exchangeRepository = {
      find: jest.fn(),
    };

    const job = new SymbolSyncJob(
      {} as any,
      {} as any,
      {} as any,
      providerAdapter as any,
      providerFactory as any,
      symbolRepository as unknown as Repository<Symbol>,
      exchangeRepository as unknown as Repository<Exchange>,
    );

    jest
      .spyOn(job as any, 'runWithLock')
      .mockImplementation(async (_options: unknown, executor: any) => {
        await executor();
      });

    return { job, providerAdapter, providerFactory, symbolRepository, exchangeRepository };
  }

  it('falls back to SSTOCK when TCBS returns empty symbols', async () => {
    const { job, providerAdapter, providerFactory, symbolRepository, exchangeRepository } =
      createJob();

    providerFactory.getSymbolListProviderEntries.mockResolvedValue([
      { code: 'TCBS_API' },
      { code: 'SSTOCK_API' },
    ]);
    providerAdapter.invokeSymbolList.mockImplementation(
      async (_method: string, _args: unknown[], preferred: string[]) => {
        if (preferred[0] === 'TCBS_API') {
          return { providerCode: 'TCBS_API', value: [] };
        }
        return {
          providerCode: 'SSTOCK_API',
          value: [
            {
              ticker: 'AAA',
              exchangeCode: 'HOSE',
              companyName: 'AAA Corp',
            },
          ],
        };
      },
    );
    exchangeRepository.find.mockResolvedValue([{ id: 'ex-hose', code: 'HOSE' }]);
    symbolRepository.find.mockResolvedValue([]);
    symbolRepository.insert.mockResolvedValue(undefined);

    await job.runNow();

    expect(providerAdapter.invokeSymbolList).toHaveBeenCalledTimes(2);
    expect(providerAdapter.invokeSymbolList).toHaveBeenNthCalledWith(
      1,
      'fetchSymbolList',
      [],
      ['TCBS_API'],
    );
    expect(providerAdapter.invokeSymbolList).toHaveBeenNthCalledWith(
      2,
      'fetchSymbolList',
      [],
      ['SSTOCK_API'],
    );
    expect(symbolRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: 'AAA',
        exchangeId: 'ex-hose',
      }),
    );
  });

  it('throws when all symbol-list providers return empty', async () => {
    const { job, providerAdapter, providerFactory, symbolRepository, exchangeRepository } =
      createJob();

    providerFactory.getSymbolListProviderEntries.mockResolvedValue([
      { code: 'TCBS_API' },
      { code: 'SSTOCK_API' },
    ]);
    providerAdapter.invokeSymbolList.mockResolvedValue({ providerCode: 'X', value: [] });
    exchangeRepository.find.mockResolvedValue([{ id: 'ex-hose', code: 'HOSE' }]);
    symbolRepository.find.mockResolvedValue([]);

    await expect(job.runNow()).rejects.toThrow(
      'No symbols returned from providers (TCBS_API, SSTOCK_API)',
    );
  });
});
