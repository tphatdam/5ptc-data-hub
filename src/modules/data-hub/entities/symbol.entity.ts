import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Exchange } from './exchange.entity';
import { StockCandle } from './stock-candle.entity';
import { StockSnapshot } from './stock-snapshot.entity';
import { StockForeignTradingDaily } from './stock-foreign-trading-daily.entity';
import { StockInsiderEvent } from './stock-insider-event.entity';

@Entity('symbol')
export class Symbol {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  ticker: string;

  @Column({ name: 'exchange_id' })
  exchangeId: number;

  @ManyToOne(() => Exchange, (exchange) => exchange.symbols)
  @JoinColumn({ name: 'exchange_id' })
  exchange: Exchange;

  @Column({ type: 'varchar', length: 255, name: 'company_name', nullable: true })
  companyName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  industry: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  isin: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'date', name: 'listed_at', nullable: true })
  listedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => StockCandle, (candle) => candle.symbol)
  candles: StockCandle[];

  @OneToMany(() => StockSnapshot, (snapshot) => snapshot.symbol)
  snapshots: StockSnapshot[];

  @OneToMany(
    () => StockForeignTradingDaily,
    (foreignTradingDaily) => foreignTradingDaily.symbol,
  )
  foreignTradingDaily: StockForeignTradingDaily[];

  @OneToMany(() => StockInsiderEvent, (insiderEvent) => insiderEvent.symbol)
  insiderEvents: StockInsiderEvent[];
}
