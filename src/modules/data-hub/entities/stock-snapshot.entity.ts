import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Symbol } from './symbol.entity';
import { DataSource } from './data-source.entity';

@Entity('stock_snapshot')
@Unique('UQ_stock_snapshot_symbol_as_of', ['symbolId', 'asOf'])
export class StockSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbolId: number;

  @ManyToOne(() => Symbol, (symbol) => symbol.snapshots)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;

  @Column({ type: 'timestamptz', name: 'as_of' })
  asOf: Date;

  @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true })
  pe: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true })
  pb: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true })
  ps: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true })
  roe: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true })
  roa: string;

  @Column({ type: 'numeric', precision: 22, scale: 4, nullable: true })
  ev: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  eps: string;

  @Column({ type: 'numeric', precision: 22, scale: 4, name: 'market_cap', nullable: true })
  marketCap: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, name: 'free_float', nullable: true })
  freeFloat: string;

  @Column({ type: 'bigint', name: 'shares_out', nullable: true })
  sharesOut: string;

  @Column({ type: 'bigint', name: 'foreign_room', nullable: true })
  foreignRoom: string;

  @Column({ type: 'bigint', name: 'foreign_holding_room', nullable: true })
  foreignHoldingRoom: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, name: 'current_holding_ratio', nullable: true })
  currentHoldingRatio: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, name: 'max_holding_ratio', nullable: true })
  maxHoldingRatio: string;

  @Column({ type: 'bigint', name: 'avg_match_volume_2w', nullable: true })
  avgMatchVolume2w: string;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource)
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
