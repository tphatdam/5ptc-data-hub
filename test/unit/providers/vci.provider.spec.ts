import { Test, TestingModule } from '@nestjs/testing';
import { VciProvider } from '../../../src/providers/vci/vci.provider';
import { HttpClientService } from '../../../src/providers/http-client.service';

describe('VciProvider', () => {
  let provider: VciProvider;
  let httpClientService: HttpClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VciProvider,
        {
          provide: HttpClientService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<VciProvider>(VciProvider);
    httpClientService = module.get<HttpClientService>(HttpClientService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should have name "VCI"', () => {
    expect(provider.name).toBe('VCI');
  });

  describe('fetchSymbols', () => {
    it('should return empty array (skeleton implementation)', async () => {
      const result = await provider.fetchSymbols();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('fetchQuoteHistory', () => {
    it('should return empty array (skeleton implementation)', async () => {
      const params = {
        symbol: 'VNM',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };
      const result = await provider.fetchQuoteHistory(params);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('fetchIntraday', () => {
    it('should return empty array (skeleton implementation)', async () => {
      const params = {
        symbol: 'VNM',
        startTime: new Date('2024-01-01T09:00:00Z'),
        endTime: new Date('2024-01-01T15:00:00Z'),
      };
      const result = await provider.fetchIntraday(params);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when called without params', async () => {
      const result = await provider.fetchIntraday();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
