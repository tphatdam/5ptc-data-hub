import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { Symbol } from './symbol.entity';
import { MarketIndex } from './market-index.entity';

@Entity('exchange')
export class Exchange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @OneToMany(() => Symbol, (symbol) => symbol.exchange)
  symbols: Symbol[];

  @OneToMany(() => MarketIndex, (index) => index.exchange)
  indices: MarketIndex[];
}
