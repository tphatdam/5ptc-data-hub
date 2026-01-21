import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { QuoteDaily } from './quote-daily.entity';
import { QuoteIntraday } from './quote-intraday.entity';

@Entity('symbols')
@Index(['symbol'], { unique: true })
export class Symbol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  symbol: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  exchange: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industryCode: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships will be added when QuoteDaily and QuoteIntraday entities are created
  @OneToMany(() => QuoteDaily, (quote) => quote.symbol)
  dailyQuotes: QuoteDaily[];

  @OneToMany(() => QuoteIntraday, (quote) => quote.symbol)
  intradayQuotes: QuoteIntraday[];
}
