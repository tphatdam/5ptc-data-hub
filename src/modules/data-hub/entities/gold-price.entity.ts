import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { DataSource } from './data-source.entity';
import { GoldProvider } from '../enums';

@Entity('gold_price')
@Unique('UQ_gold_price_provider_as_of', ['provider', 'asOf'])
export class GoldPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: GoldProvider,
  })
  provider: GoldProvider;

  @Column({ type: 'date', name: 'as_of' })
  asOf: Date;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  buy: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  sell: string;

  @Column({ type: 'jsonb', nullable: true })
  raw: Record<string, any>;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource)
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
