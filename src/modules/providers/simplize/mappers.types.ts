export interface BulkUpsertQuoteIntradayDto {
  symbolId: string;
  ts: Date;
  price: number;
  volume: string;
  matchType?: string | null;
  tradeId?: string | null;
  priceChange?: number | null;
  accumulatedVolume?: string | null;
  accumulatedValue?: string | null;
  source: string;
}

export interface BulkUpsertQuoteDailyDto {
  symbolId: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
  value?: string | null;
  putThroughVolume?: string | null;
  putThroughValue?: string | null;
  foreignBuyVolume?: string | null;
  foreignSellVolume?: string | null;
  foreignNetVolume?: string | null;
  totalTrades?: string | null;
  source: string;
}

export interface BulkUpsertForeignTradingDailyDto {
  symbolId: string;
  date: Date;
  buyVolume: string | null;
  sellVolume: string | null;
  netVolume: string | null;
  buyValue?: string | null;
  sellValue?: string | null;
  netValue?: string | null;
  source: string;
}

export interface BulkUpsertInsiderTradingEventDto {
  symbolId: string;
  transactionDate: Date;
  announceDate?: Date | null;
  insiderName: string | null;
  insiderRole: string | null;
  transactionType: string | null;
  dealMethod?: string | null;
  actionType?: string | null;
  quantity: string | null;
  price: number | null;
  ownershipRatio?: string | null;
  source: string;
}

export interface BulkUpsertStockRelatedPeerDto {
  symbolId: string;
  peerTicker: string;
  relationType: string | null;
  score: number | null;
  source: string;
}

export interface BulkUpsertCompanySubsidiaryDto {
  parentSymbolId: string;
  subsidiaryName: string;
  ownershipPercent: number | null;
  relationshipType: string | null;
  source: string;
}

export interface BulkUpsertNewsArticleDto {
  url: string;
  urlHash: string;
  publishedAt: Date | null;
  title: string;
  summary: string | null;
  subtitle?: string | null;
  content: string | null;
  tickers: string[] | null;
  tags: string[] | null;
  source: string;
  providerNewsId?: string | null;
  languageCode?: string | null;
  sourceLink?: string | null;
  imageUrl?: string | null;
  sourceCreatedAt?: Date | null;
  sourceUpdatedAt?: Date | null;
  fetchedAt: Date;
}

export interface BulkUpsertCompanyReportDto {
  symbolId: string;
  reportType: string;
  title: string | null;
  publishedAt: Date | null;
  fileUrl: string;
  fileUrlHash: string;
  source: string;
}
