/**
 * Adapter interfaces for API compatibility layer.
 * Swap implementations via DI to change upstream source.
 */

export interface IContentProvider {
  readonly code: string;
  getArticles(params?: Record<string, string>): Promise<unknown>;
  getArticleById(identifier: string): Promise<unknown>;
  searchArticles(params?: Record<string, string>): Promise<unknown>;
  getRelatedArticles(params?: Record<string, string>): Promise<unknown>;
  getCategories(): Promise<unknown>;
  getFilters(): Promise<unknown>;
  getTickers(): Promise<unknown>;
}

export interface IPricingProvider {
  readonly code: string;
  getMarket(params?: Record<string, string>): Promise<unknown>;
  getMarketIndustries(): Promise<unknown>;
  getGoldPrices(): Promise<unknown>;
  getExchangeRates(): Promise<unknown>;
  getMarketSentiment(): Promise<unknown>;
  getTopStocks(params?: Record<string, string>): Promise<unknown>;
}

export interface IStockProxyProvider {
  readonly code: string;
  get(path: string, query?: Record<string, string>): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  delete?(path: string): Promise<unknown>;
}

export interface IRecommendationProvider {
  readonly code: string;
  getRecommendations(params?: Record<string, string>): Promise<unknown>;
  getWatchlists(): Promise<unknown>;
  getAlerts(): Promise<unknown>;
  getNotifications(): Promise<unknown>;
}
