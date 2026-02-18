import { TcbsProvider } from './tcbs.provider';
import { HttpClientService } from '../services/http-client.service';
import { CandleInterval } from '../enums';
import { AxiosResponse, AxiosHeaders } from 'axios';
import { ConfigService } from '@nestjs/config';

const createMockResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});

describe('TcbsProvider', () => {
  let provider: TcbsProvider;
  let httpClientMock: jest.Mocked<HttpClientService>;
  let configServiceMock: jest.Mocked<ConfigService>;

  beforeEach(() => {
    httpClientMock = {
      get: jest.fn(),
      post: jest.fn(),
    } as any;

    configServiceMock = {
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    provider = new TcbsProvider(httpClientMock, configServiceMock);
  });

  describe('fetchDailyCandles1d', () => {
    it('should map API response to CandleDTO correctly', async () => {
      const mockData = {
        data: [
          {
            tradingDate: '2026-01-15',
            open: 100.5,
            high: 105.0,
            low: 99.0,
            close: 103.5,
            volume: 1000000,
            value: 103500000,
          },
        ],
      };

      httpClientMock.get.mockResolvedValue(createMockResponse(mockData));

      const result = await provider.fetchDailyCandles1d(['VNM'], new Date('2026-01-15'));

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ticker: 'VNM',
        interval: CandleInterval.DAILY,
        ts: '2026-01-15',
        open: 100.5,
        high: 105.0,
        low: 99.0,
        close: 103.5,
        volume: 1000000,
        value: 103500000,
      });
    });

    it('should handle empty response gracefully', async () => {
      httpClientMock.get.mockResolvedValue(createMockResponse({ data: [] }));

      const result = await provider.fetchDailyCandles1d(['VNM'], new Date('2026-01-15'));

      expect(result).toHaveLength(0);
    });

    it('should continue processing other tickers on error', async () => {
      httpClientMock.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(
          createMockResponse({
            data: [
              {
                tradingDate: '2026-01-15',
                open: 50.0,
                high: 52.0,
                low: 49.0,
                close: 51.0,
                volume: 500000,
              },
            ],
          })
        );

      const result = await provider.fetchDailyCandles1d(['FAIL', 'HPG'], new Date('2026-01-15'));

      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('HPG');
    });
  });

  describe('fetchSnapshots', () => {
    it('should map snapshot response correctly', async () => {
      const mockData = {
        pe: 15.5,
        eps: 3200,
        marketCap: 150000000000000,
        freeFloat: 0.65,
        sharesOutstanding: 1000000000,
      };

      httpClientMock.get.mockResolvedValue(createMockResponse(mockData));

      const result = await provider.fetchSnapshots(['VNM']);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ticker: 'VNM',
        pe: 15.5,
        eps: 3200,
        marketCap: 150000000000000,
        freeFloat: 0.65,
        sharesOut: 1000000000,
      });
      expect(result[0].asOf).toBeDefined();
    });

    it('should handle missing fields gracefully', async () => {
      const mockData = { pe: 12.0 };

      httpClientMock.get.mockResolvedValue(createMockResponse(mockData));

      const result = await provider.fetchSnapshots(['HPG']);

      expect(result).toHaveLength(1);
      expect(result[0].pe).toBe(12.0);
      expect(result[0].eps).toBeUndefined();
      expect(result[0].marketCap).toBeUndefined();
    });
  });

  describe('fetchSymbolList', () => {
    it('should map symbol list response correctly', async () => {
      const mockData = [
        {
          ticker: 'VNM',
          companyName: 'Vinamilk',
          industry: 'Food & Beverage',
          exchange: 'HOSE',
        },
        {
          ticker: 'HPG',
          shortName: 'Hoa Phat Group',
          exchange: 'HSX',
        },
      ];

      httpClientMock.get.mockResolvedValue(createMockResponse(mockData));

      const result = await provider.fetchSymbolList();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        ticker: 'VNM',
        exchangeCode: 'HOSE',
        companyName: 'Vinamilk',
        industry: 'Food & Beverage',
      });
      expect(result[1]).toMatchObject({
        ticker: 'HPG',
        exchangeCode: 'HOSE',
        companyName: 'Hoa Phat Group',
      });
    });

    it('should map exchange codes correctly', async () => {
      const mockData = [
        { ticker: 'A', exchange: 'HOSE' },
        { ticker: 'B', exchange: 'HSX' },
        { ticker: 'C', exchange: 'HNX' },
        { ticker: 'D', exchange: 'UPCOM' },
      ];

      httpClientMock.get.mockResolvedValue(createMockResponse(mockData));

      const result = await provider.fetchSymbolList();

      expect(result[0].exchangeCode).toBe('HOSE');
      expect(result[1].exchangeCode).toBe('HOSE');
      expect(result[2].exchangeCode).toBe('HNX');
      expect(result[3].exchangeCode).toBe('UPCOM');
    });
  });
});
