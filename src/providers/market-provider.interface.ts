import { SymbolDTO, DailyBarDTO, IntradayTickDTO } from './dtos';

/**
 * MarketProvider interface defines the contract for market data providers.
 * Implementations should fetch data from external market data sources and
 * normalize it to the internal DTO formats.
 */
export interface MarketProvider {
  /**
   * The name of the provider (e.g., 'VCI', 'SSI')
   */
  readonly name: string;

  /**
   * Fetch all available symbols from the provider
   * @returns Array of symbol DTOs
   */
  fetchSymbols(): Promise<SymbolDTO[]>;

  /**
   * Fetch historical daily quote data for a symbol
   * @param params - Parameters including symbol, start date, and end date
   * @returns Array of daily bar DTOs
   */
  fetchQuoteHistory(params: {
    symbol: string;
    startDate: Date;
    endDate: Date;
  }): Promise<DailyBarDTO[]>;

  /**
   * Fetch intraday tick data for a symbol
   * @param params - Optional parameters including symbol, start time, and end time
   * @returns Array of intraday tick DTOs
   */
  fetchIntraday(params?: {
    symbol: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<IntradayTickDTO[]>;
}
