import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Symbol } from './symbol.entity';
import { DataSource } from './data-source.entity';

@Entity('stock_foreign_trading_daily')
@Unique('UQ_stock_foreign_trading_daily_symbol_trade_date_source', [
  'symbolId',
  'tradeDate',
  'sourceId',
])
@Index('IDX_stock_foreign_trading_daily_symbol_trade_date', ['symbolId', 'tradeDate'])
export class StockForeignTradingDaily {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbolId: number;

  @ManyToOne(() => Symbol, (symbol) => symbol.foreignTradingDaily)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;

  @Column({ type: 'date', name: 'trade_date' })
  tradeDate: Date;

  @Column({ type: 'bigint', name: 'buy_volume', nullable: true })
  buyVolume: string;

  @Column({ type: 'bigint', name: 'sell_volume', nullable: true })
  sellVolume: string;

  @Column({ type: 'bigint', name: 'net_volume', nullable: true })
  netVolume: string;

  @Column({ type: 'numeric', precision: 22, scale: 4, name: 'buy_value', nullable: true })
  buyValue: string;

  @Column({ type: 'numeric', precision: 22, scale: 4, name: 'sell_value', nullable: true })
  sellValue: string;

  @Column({ type: 'numeric', precision: 22, scale: 4, name: 'net_value', nullable: true })
  netValue: string;

  @Column({ type: 'bigint', name: 'foreign_room', nullable: true })
  foreignRoom: string;

  @Column({ type: 'bigint', name: 'foreign_holding_room', nullable: true })
  foreignHoldingRoom: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, name: 'current_holding_ratio', nullable: true })
  currentHoldingRatio: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, name: 'max_holding_ratio', nullable: true })
  maxHoldingRatio: string;

  @Column({ type: 'jsonb', name: 'raw_payload', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource)
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
