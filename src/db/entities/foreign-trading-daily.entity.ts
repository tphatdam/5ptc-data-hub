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

@Entity('foreign_trading_daily')
@Index(['symbolId', 'date'])
@Unique(['symbolId', 'date', 'source'])
export class ForeignTradingDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  symbolId: string;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbolId' })
  symbol: Symbol;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'bigint', nullable: true })
  buyVolume: string | null;

  @Column({ type: 'bigint', nullable: true })
  sellVolume: string | null;

  @Column({ type: 'bigint', nullable: true })
  netVolume: string | null;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}

