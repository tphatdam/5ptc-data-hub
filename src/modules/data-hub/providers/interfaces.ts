import {
  CandleDTO,
  IndexCandleDTO,
  SnapshotDTO,
  GoldPriceDTO,
  NewsArticleDTO,
  ForeignTradingDailyDTO,
  InsiderEventDTO,
} from '../dto';

export interface MarketDataProvider {
  readonly code: string;

  fetchIntradayCandles15m(
    tickers: string[],
    from: Date,
    to: Date
  ): Promise<CandleDTO[]>;

  fetchDailyCandles1d(
    tickers: string[],
    date: Date
  ): Promise<CandleDTO[]>;

  fetchIndexCandles(
    indexCodes: string[],
    interval: '1d' | '15m',
    from: Date,
    to: Date
  ): Promise<IndexCandleDTO[]>;
}

export interface FundamentalsProvider {
  readonly code: string;

  fetchSnapshots(tickers: string[]): Promise<SnapshotDTO[]>;
}

export interface GoldPriceProvider {
  readonly code: string;

  fetchGold(provider: string, date: Date): Promise<GoldPriceDTO | null>;
}

export interface NewsProvider {
  readonly code: string;

  fetchLatest(since: Date): Promise<NewsArticleDTO[]>;
}

export interface SymbolInfo {
  ticker: string;
  exchangeCode: string;
  companyName?: string;
  industry?: string;
  isin?: string;
}

export interface SymbolListProvider {
  readonly code: string;

  fetchSymbolList(): Promise<SymbolInfo[]>;
}

export interface CompanyIntelProvider {
  readonly code: string;

  fetchForeignTradingDaily(
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<ForeignTradingDailyDTO[]>;

  fetchInsiderEvents(
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<InsiderEventDTO[]>;
}

export type ProviderCapability =
  | 'market'
  | 'fundamentals'
  | 'gold'
  | 'news'
  | 'symbol-list'
  | 'company-intel';

export type AnyDataProvider =
  | MarketDataProvider
  | FundamentalsProvider
  | GoldPriceProvider
  | NewsProvider
  | SymbolListProvider
  | CompanyIntelProvider;

export interface RegisteredProvider<TProvider extends AnyDataProvider = AnyDataProvider> {
  code: string;
  provider: TProvider;
}
