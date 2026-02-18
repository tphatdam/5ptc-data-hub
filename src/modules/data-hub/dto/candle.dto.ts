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
  content?: string;

  @IsOptional()
  @IsString({ each: true })
  tickers?: string[];

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}
