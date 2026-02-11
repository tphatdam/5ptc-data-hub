import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { SeedService } from '../../../src/seed/seed.service';
import { SStockSeedSource } from '../../../src/seed/sources/sstock.source';
import { StaticSeedSource } from '../../../src/seed/sources/static.source';
import { Exchange, MarketIndex, Symbol } from '../../../src/data-hub/entities';

describe('SeedService', () => {
  let service: SeedService;
  let exchangeRepo: { upsert: jest.Mock; find: jest.Mock };
  let symbolRepo: { upsert: jest.Mock };
  let marketIndexRepo: { upsert: jest.Mock };
  let dataSource: { query: jest.Mock };
  let staticSource: { fetchAll: jest.Mock };
  let sstockSource: { fetchAll: jest.Mock };
  let configService: { get: jest.Mock };

  const mockSeedData = {
    exchanges: [
      { code: 'HOSE', name: 'Ho Chi Minh Stock Exchange' },
      { code: 'HNX', name: 'Hanoi Stock Exchange' },
    ],
    symbols: [
      { ticker: 'VCB', exchangeCode: 'HOSE', companyName: 'Vietcombank' },
      { ticker: 'VNM', exchangeCode: 'HOSE', companyName: 'Vinamilk' },
    ],
    indices: [
      { code: 'VNINDEX', name: 'VN Index', exchangeCode: 'HOSE' },
    ],
  };

  beforeEach(async () => {
    exchangeRepo = { upsert: jest.fn().mockResolvedValue(undefined), find: jest.fn().mockResolvedValue([{ id: 1, code: 'HOSE' }, { id: 2, code: 'HNX' }]) };
    symbolRepo = { upsert: jest.fn().mockResolvedValue(undefined) };
    marketIndexRepo = { upsert: jest.fn().mockResolvedValue(undefined) };
    dataSource = { query: jest.fn().mockResolvedValue([{ acquired: true }]) };
    staticSource = { fetchAll: jest.fn().mockResolvedValue(mockSeedData) };
    sstockSource = { fetchAll: jest.fn().mockResolvedValue(mockSeedData) };
    configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'seed.source': 'sstock',
          'seed.fallback': true,
          'seed.advisoryLockKey': 987654321,
          'seed.batchSize': 300,
        };
        return map[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        { provide: getRepositoryToken(Exchange), useValue: exchangeRepo },
        { provide: getRepositoryToken(Symbol), useValue: symbolRepo },
        { provide: getRepositoryToken(MarketIndex), useValue: marketIndexRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: SStockSeedSource, useValue: sstockSource },
        { provide: StaticSeedSource, useValue: staticSource },
        { provide: PinoLogger, useValue: { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
  });

  it('should acquire advisory lock and run upserts when source returns data', async () => {
    await service.run({ source: 'static' });

    expect(dataSource.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1) as acquired', [987654321]);
    expect(staticSource.fetchAll).toHaveBeenCalled();
    expect(exchangeRepo.upsert).toHaveBeenCalledWith(mockSeedData.exchanges, ['code']);
    expect(exchangeRepo.find).toHaveBeenCalled();
    expect(symbolRepo.upsert).toHaveBeenCalled();
    expect(marketIndexRepo.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ code: 'VNINDEX', name: 'VN Index' })]),
      ['code'],
    );
    expect(dataSource.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [987654321]);
  });

  it('should skip seeding when advisory lock is not acquired', async () => {
    dataSource.query.mockResolvedValueOnce([{ acquired: false }]);

    await service.run({ source: 'static' });

    expect(staticSource.fetchAll).toHaveBeenCalled();
    expect(exchangeRepo.upsert).not.toHaveBeenCalled();
  });

  it('should fallback to static source on sstock failure when fallback is true', async () => {
    sstockSource.fetchAll.mockRejectedValueOnce(Object.assign(new Error('HTTP 401'), { status: 401 }));

    await service.run({ source: 'sstock', fallback: true });

    expect(sstockSource.fetchAll).toHaveBeenCalled();
    expect(staticSource.fetchAll).toHaveBeenCalled();
    expect(exchangeRepo.upsert).toHaveBeenCalled();
  });

  it('should throw when sstock fails and fallback is false', async () => {
    sstockSource.fetchAll.mockRejectedValueOnce(Object.assign(new Error('HTTP 401'), { status: 401 }));

    await expect(service.run({ source: 'sstock', fallback: false })).rejects.toThrow('HTTP 401');
    expect(staticSource.fetchAll).not.toHaveBeenCalled();
  });
});
