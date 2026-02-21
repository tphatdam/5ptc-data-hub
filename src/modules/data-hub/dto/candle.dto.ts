import { IsString, IsNumber, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { CandleInterval } from '../enums';

export class CandleDTO {
  @IsString()
  ticker: string;

  @IsEnum(CandleInterval)
  interval: CandleInterval;

  @IsDateString()
  ts: string;

  @IsNumber()
  open: number;

  @IsNumber()
  high: number;

  @IsNumber()
  low: number;

  @IsNumber()
  close: number;

  @IsNumber()
  volume: number;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsNumber()
  foreignBuyVolume?: number;

  @IsOptional()
  @IsNumber()
  foreignSellVolume?: number;

  @IsOptional()
  @IsNumber()
  foreignNetVolume?: number;

  @IsOptional()
  @IsNumber()
  putThroughVolume?: number;

  @IsOptional()
  @IsNumber()
  putThroughValue?: number;

  @IsOptional()
  @IsNumber()
  totalTrades?: number;
}

export class IndexCandleDTO {
  @IsString()
  indexCode: string;

  @IsEnum(CandleInterval)
  interval: CandleInterval;

  @IsDateString()
  ts: string;

  @IsNumber()
  open: number;

  @IsNumber()
  high: number;

  @IsNumber()
  low: number;

  @IsNumber()
  close: number;

  @IsOptional()
  @IsNumber()
  volume?: number;
}

export class SnapshotDTO {
  @IsString()
  ticker: string;

  @IsDateString()
  asOf: string;

  @IsOptional()
  @IsNumber()
  pe?: number;

  @IsOptional()
  @IsNumber()
  pb?: number;

  @IsOptional()
  @IsNumber()
  ps?: number;

  @IsOptional()
  @IsNumber()
  roe?: number;

  @IsOptional()
  @IsNumber()
  roa?: number;

  @IsOptional()
  @IsNumber()
  ev?: number;

  @IsOptional()
  @IsNumber()
  eps?: number;

  @IsOptional()
  @IsNumber()
  marketCap?: number;

  @IsOptional()
  @IsNumber()
  freeFloat?: number;

  @IsOptional()
  @IsNumber()
  sharesOut?: number;

  @IsOptional()
  @IsNumber()
  foreignRoom?: number;

  @IsOptional()
  @IsNumber()
  foreignHoldingRoom?: number;

  @IsOptional()
  @IsNumber()
  currentHoldingRatio?: number;

  @IsOptional()
  @IsNumber()
  maxHoldingRatio?: number;

  @IsOptional()
  @IsNumber()
  avgMatchVolume2w?: number;
}

export class GoldPriceDTO {
  @IsString()
  provider: string;

  @IsDateString()
  asOf: string;

  @IsNumber()
  buy: number;

  @IsNumber()
  sell: number;

  @IsOptional()
  raw?: Record<string, any>;
}

export class NewsArticleDTO {
  @IsString()
  url: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString({ each: true })
  tickers?: string[];

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  providerNewsId?: string;

  @IsOptional()
  @IsString()
  langCode?: string;

  @IsOptional()
  @IsString()
  sourceLink?: string;

  @IsOptional()
  @IsString()
  newsImageUrl?: string;

  @IsOptional()
  @IsDateString()
  sourceCreatedAt?: string;

  @IsOptional()
  @IsDateString()
  sourceUpdatedAt?: string;
}

export class ForeignTradingDailyDTO {
  @IsString()
  ticker: string;

  @IsDateString()
  tradeDate: string;

  @IsOptional()
  @IsNumber()
  buyVolume?: number;

  @IsOptional()
  @IsNumber()
  sellVolume?: number;

  @IsOptional()
  @IsNumber()
  netVolume?: number;

  @IsOptional()
  @IsNumber()
  buyValue?: number;

  @IsOptional()
  @IsNumber()
  sellValue?: number;

  @IsOptional()
  @IsNumber()
  netValue?: number;

  @IsOptional()
  @IsNumber()
  foreignRoom?: number;

  @IsOptional()
  @IsNumber()
  foreignHoldingRoom?: number;

  @IsOptional()
  @IsNumber()
  currentHoldingRatio?: number;

  @IsOptional()
  @IsNumber()
  maxHoldingRatio?: number;

  @IsOptional()
  rawPayload?: Record<string, unknown>;
}

export class InsiderEventDTO {
  @IsString()
  ticker: string;

  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsDateString()
  announceDate?: string;

  @IsOptional()
  @IsString()
  insiderName?: string;

  @IsOptional()
  @IsString()
  insiderRole?: string;

  @IsOptional()
  @IsString()
  relatedPerson?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @IsString()
  dealMethod?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  quantityRegistered?: number;

  @IsOptional()
  @IsNumber()
  quantityExecuted?: number;

  @IsOptional()
  @IsNumber()
  quantityRemaining?: number;

  @IsOptional()
  @IsNumber()
  priceFrom?: number;

  @IsOptional()
  @IsNumber()
  priceTo?: number;

  @IsOptional()
  @IsNumber()
  avgPrice?: number;

  @IsOptional()
  @IsNumber()
  dealValue?: number;

  @IsOptional()
  @IsNumber()
  ownershipBefore?: number;

  @IsOptional()
  @IsNumber()
  ownershipAfter?: number;

  @IsOptional()
  @IsNumber()
  ownershipChange?: number;

  @IsOptional()
  @IsString()
  sourceEventId?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  rawPayload?: Record<string, unknown>;
}
