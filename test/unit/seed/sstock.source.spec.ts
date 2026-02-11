import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { SStockSeedSource } from '../../../src/seed/sources/sstock.source';
import { SeedHttpClient } from '../../../src/seed/http/seed-http.client';
import * as fs from 'fs';
import * as path from 'path';

describe('SStockSeedSource', () => {
  let source: SStockSeedSource;
  let httpClient: { get: jest.Mock };

  beforeEach(async () => {
    httpClient = {
      get: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SStockSeedSource,
        { provide: ConfigService, useValue: { get: jest.fn((k: string) => (k === 'seed.sstockBaseUrl' ? 'https://api-feature.sstock.vn' : undefined)) } },
        { provide: SeedHttpClient, useValue: httpClient },
        { provide: PinoLogger, useValue: { setContext: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    source = module.get<SStockSeedSource>(SStockSeedSource);
  });

  it('should map fixture JSON to DTOs with defensive field names', async () => {
    const fixturePath = path.join(__dirname, '../../fixtures/sstock-company-all.sample.json');
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    httpClient.get.mockResolvedValue({ data: raw, status: 200 });

    const result = await source.fetchAll();

    expect(result.exchanges.length).toBeGreaterThanOrEqual(2);
    const codes = result.exchanges.map((e) => e.code);
    expect(codes).toContain('HOSE');
    expect(codes).toContain('HNX');

    expect(result.symbols).toHaveLength(4);

    const vcb = result.symbols.find((s) => s.ticker === 'VCB');
    expect(vcb).toBeDefined();
    expect(vcb?.companyName).toBe('Vietcombank');
    expect(vcb?.exchangeCode).toBe('HOSE');
    expect(vcb?.industry).toBeDefined();

    const vnm = result.symbols.find((s) => s.ticker === 'VNM');
    expect(vnm?.companyName).toBe('Vinamilk');
    expect(vnm?.exchangeCode).toBe('HOSE');

    const fpt = result.symbols.find((s) => s.ticker === 'FPT');
    expect(fpt?.companyName).toBe('FPT Corporation');
    expect(fpt?.exchangeCode).toBe('HOSE');

    const pvt = result.symbols.find((s) => s.ticker === 'PVT');
    expect(pvt?.exchangeCode).toBe('HNX');
  });

  it('should normalize HSX to HOSE', async () => {
    httpClient.get.mockResolvedValue({
      data: [{ code: 'SSB', name: 'SSB', exchange: 'HSX' }],
      status: 200,
    });

    const result = await source.fetchAll();

    expect(result.symbols[0].exchangeCode).toBe('HOSE');
    expect(result.exchanges.some((e) => e.code === 'HOSE')).toBe(true);
  });
});
