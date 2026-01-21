import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Symbol } from './symbol.entity';

@Entity('quote_daily')
@Index(['symbolId', 'date'])
@Unique(['symbolId', 'date', 'source'])
export class QuoteDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  symbolId: string;

  @ManyToOne(() => Symbol, (symbol) => symbol.dailyQuotes)
  @JoinColumn({ name: 'symbolId' })
  symbol: Symbol;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'double precision' })
  open: number;

  @Column({ type: 'double precision' })
  high: number;

  @Column({ type: 'double precision' })
  low: number;

  @Column({ type: 'double precision' })
  close: number;

  @Column({ type: 'varchar', length: 50 })
  volume: string; // bigint as string

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}
