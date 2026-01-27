import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Symbol } from './symbol.entity';

@Entity('insider_trading_events')
@Index(['symbolId', 'transactionDate'])
@Unique([
  'symbolId',
  'transactionDate',
  'insiderName',
  'transactionType',
  'quantity',
  'price',
  'source',
])
export class InsiderTradingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  symbolId: string;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbolId' })
  symbol: Symbol;

  @Column({ type: 'date' })
  transactionDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  insiderName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  insiderRole: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  transactionType: string | null;

  @Column({ type: 'bigint', nullable: true })
  quantity: string | null;

  @Column({ type: 'double precision', nullable: true })
  price: number | null;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}

