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

@Entity('quote_intraday')
@Index(['symbolId', 'ts'])
@Unique(['symbolId', 'ts', 'source'])
export class QuoteIntraday {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  symbolId: string;

  @ManyToOne(() => Symbol, (symbol) => symbol.intradayQuotes)
  @JoinColumn({ name: 'symbolId' })
  symbol: Symbol;

  @Column({ type: 'timestamptz' })
  ts: Date;

  @Column({ type: 'double precision' })
  price: number;

  @Column({ type: 'varchar', length: 50 })
  volume: string; // bigint as string

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}
