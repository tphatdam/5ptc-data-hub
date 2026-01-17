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
import { MarketIndex } from './market-index.entity';
import { DataSource } from './data-source.entity';
import { CandleInterval } from '../enums';

@Entity('index_candle')
@Unique('UQ_index_candle_index_interval_ts', ['indexId', 'interval', 'ts'])
export class IndexCandle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'index_id' })
  indexId: number;

  @ManyToOne(() => MarketIndex, (index) => index.candles)
  @JoinColumn({ name: 'index_id' })
  index: MarketIndex;

  @Column({
    type: 'enum',
    enum: CandleInterval,
  })
  interval: CandleInterval;

  @Column({ type: 'timestamptz' })
  @Index()
  ts: Date;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  open: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  high: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  low: string;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  close: string;

  @Column({ type: 'bigint', nullable: true })
  volume: string;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource)
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
