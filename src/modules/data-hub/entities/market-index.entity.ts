import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Exchange } from './exchange.entity';
import { IndexCandle } from './index-candle.entity';

@Entity('market_index')
export class MarketIndex {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'exchange_id', nullable: true })
  exchangeId: number;

  @ManyToOne(() => Exchange, (exchange) => exchange.indices, { nullable: true })
  @JoinColumn({ name: 'exchange_id' })
  exchange: Exchange;

  @OneToMany(() => IndexCandle, (candle) => candle.index)
  candles: IndexCandle[];
}
