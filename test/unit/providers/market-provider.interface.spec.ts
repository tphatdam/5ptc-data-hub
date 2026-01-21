import { MarketProvider } from '../../../src/providers/market-provider.interface';
import { SymbolDTO, DailyBarDTO, IntradayTickDTO } from '../../../src/providers/dtos';

describe('MarketProvider Interface', () => {
  it('should be implementable by a concrete class', () => {
    class TestProvider implements MarketProvider {
      readonly name = 'TestProvider';

      async fetchSymbols(): Promise<SymbolDTO[]> {
        return [
          {
            symbol: 'TEST',
            exchange: 'HOSE',
            name: 'Test Company',
            industryCode: 'TEST',
          },
        ];
      }

      async fetchQuoteHistory(params: {
        symbol: string;
        startDate: Date;
        endDate: Date;
      }): Promise<DailyBarDTO[]> {
        return [
          {
            date: new Date('2024-01-15'),
            open: 100,
            high: 105,
            low: 99,
            close: 103,
            volume: '1000000',
          },
        ];
      }

      async fetchIntraday(params?: {
        symbol: string;
        startTime?: Date;
        endTime?: Date;
      }): Promise<IntradayTickDTO[]> {
        return [
          {
            ts: new Date('2024-01-15T10:30:00Z'),
            price: 103,
            volume: '50000',
          },
        ];
      }
    }

    const provider = new TestProvider();
    expect(provider).toBeDefined();
    expect(provider.name).toBe('TestProvider');
  });

  it('should allow calling all interface methods', async () => {
    class MockProvider implements MarketProvider {
      readonly name = 'MockProvider';

      async fetchSymbols(): Promise<SymbolDTO[]> {
        return [];
      }

      async fetchQuoteHistory(params: {
        symbol: string;
        startDate: Date;
        endDate: Date;
      }): Promise<DailyBarDTO[]> {
        return [];
      }

      async fetchIntraday(params?: {
        symbol: string;
        startTime?: Date;
        endTime?: Date;
      }): Promise<IntradayTickDTO[]> {
        return [];
      }
    }

    const provider = new MockProvider();

    const symbols = await provider.fetchSymbols();
    expect(symbols).toEqual([]);

    const history = await provider.fetchQuoteHistory({
      symbol: 'TEST',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-15'),
    });
    expect(history).toEqual([]);

    const intraday = await provider.fetchIntraday({
      symbol: 'TEST',
      startTime: new Date('2024-01-15T09:00:00Z'),
      endTime: new Date('2024-01-15T16:00:00Z'),
    });
    expect(intraday).toEqual([]);
  });

  it('should enforce readonly name property', () => {
    class TestProvider implements MarketProvider {
      readonly name = 'TestProvider';

      async fetchSymbols(): Promise<SymbolDTO[]> {
        return [];
      }

      async fetchQuoteHistory(params: {
        symbol: string;
        startDate: Date;
        endDate: Date;
      }): Promise<DailyBarDTO[]> {
        return [];
      }

      async fetchIntraday(params?: {
        symbol: string;
        startTime?: Date;
        endTime?: Date;
      }): Promise<IntradayTickDTO[]> {
        return [];
      }
    }

    const provider = new TestProvider();
    expect(provider.name).toBe('TestProvider');
    
    // TypeScript should prevent this at compile time
    // provider.name = 'NewName'; // This would cause a compile error
  });
});
