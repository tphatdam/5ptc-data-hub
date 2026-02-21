import {
  IsString,
  IsOptional,
  IsDate,
  IsNumber,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * SymbolDTO represents a tradable security symbol
 */
export class SymbolDTO {
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsOptional()
  exchange?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  industryCode?: string;
}

/**
 * DailyBarDTO represents end-of-day OHLCV data for a symbol
 */
export class DailyBarDTO {
  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsNumber()
  @Min(0)
  open: number;

  @IsNumber()
  @Min(0)
  high: number;

  @IsNumber()
  @Min(0)
  low: number;

  @IsNumber()
  @Min(0)
  close: number;

  @IsString()
  @IsNotEmpty()
  volume: string; // bigint as string

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  putThroughVolume?: string;

  @IsOptional()
  @IsString()
  putThroughValue?: string;

  @IsOptional()
  @IsString()
  foreignBuyVolume?: string;

  @IsOptional()
  @IsString()
  foreignSellVolume?: string;

  @IsOptional()
  @IsString()
  foreignNetVolume?: string;

  @IsOptional()
  @IsString()
  totalTrades?: string;
}

/**
 * IntradayTickDTO represents intraday tick data with timestamp, price, and volume
 */
export class IntradayTickDTO {
  @IsDate()
  @Type(() => Date)
  ts: Date;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  volume: string; // bigint as string

  @IsOptional()
  @IsString()
  matchType?: string;

  @IsOptional()
  @IsString()
  tradeId?: string;

  @IsOptional()
  @IsNumber()
  priceChange?: number;

  @IsOptional()
  @IsString()
  accumulatedVolume?: string;

  @IsOptional()
  @IsString()
  accumulatedValue?: string;
}
