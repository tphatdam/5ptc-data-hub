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
import { CandleInterval } from '../enums';

@Entity('stock_candle')
@Unique('UQ_stock_candle_symbol_interval_ts', ['symbolId', 'interval', 'ts'])
@Index('IDX_stock_candle_symbol_ts', ['symbolId', 'ts'])
export class StockCandle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbolId: number;

  @ManyToOne(() => Symbol, (symbol) => symbol.candles)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;

  @Column({
    type: 'enum',
    enum: CandleInterval,
  })
  interval: CandleInterval;

  @Column({ type: 'timestamptz' })
  ts: Date;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  open: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  high: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  low: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  close: string;

  @Column({ type: 'bigint' })
  volume: string;

  @Column({ type: 'numeric', precision: 22, scale: 4, nullable: true })
  value: string;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource)
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
