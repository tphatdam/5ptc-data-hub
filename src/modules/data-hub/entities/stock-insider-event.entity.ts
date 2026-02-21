import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Symbol } from './symbol.entity';
import { DataSource } from './data-source.entity';

@Entity('stock_insider_event')
@Unique('UQ_stock_insider_event_core', [
  'symbolId',
  'transactionDate',
  'insiderName',
  'actionType',
  'quantityExecuted',
  'sourceId',
])
@Index('IDX_stock_insider_event_symbol_transaction', ['symbolId', 'transactionDate'])
@Index('IDX_stock_insider_event_source_event_id', ['sourceId', 'sourceEventId'])
export class StockInsiderEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbolId: number;

  @ManyToOne(() => Symbol, (symbol) => symbol.insiderEvents)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;

  @Column({ type: 'date', name: 'announce_date', nullable: true })
  announceDate: Date;

  @Column({ type: 'date', name: 'transaction_date' })
  transactionDate: Date;

  @Column({ type: 'varchar', length: 255, name: 'insider_name', nullable: true })
  insiderName: string;

  @Column({ type: 'varchar', length: 255, name: 'insider_role', nullable: true })
  insiderRole: string;

  @Column({ type: 'varchar', length: 255, name: 'related_person', nullable: true })
  relatedPerson: string;

  @Column({ type: 'varchar', length: 50, name: 'action_type', nullable: true })
  actionType: string;

  @Column({ type: 'varchar', length: 100, name: 'deal_method', nullable: true })
  dealMethod: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;

  @Column({ type: 'bigint', name: 'quantity_registered', nullable: true })
  quantityRegistered: string;

  @Column({ type: 'bigint', name: 'quantity_executed', nullable: true })
  quantityExecuted: string;

  @Column({ type: 'bigint', name: 'quantity_remaining', nullable: true })
  quantityRemaining: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, name: 'price_from', nullable: true })
  priceFrom: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, name: 'price_to', nullable: true })
  priceTo: string;

  @Column({ type: 'numeric', precision: 18, scale: 4, name: 'avg_price', nullable: true })
  avgPrice: string;

  @Column({ type: 'numeric', precision: 22, scale: 4, name: 'deal_value', nullable: true })
  dealValue: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, name: 'ownership_before', nullable: true })
  ownershipBefore: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, name: 'ownership_after', nullable: true })
  ownershipAfter: string;

  @Column({ type: 'numeric', precision: 10, scale: 4, name: 'ownership_change', nullable: true })
  ownershipChange: string;

  @Column({ type: 'varchar', length: 128, name: 'source_event_id', nullable: true })
  sourceEventId: string;

  @Column({ type: 'text', name: 'source_url', nullable: true })
  sourceUrl: string;

  @Column({ type: 'jsonb', name: 'raw_payload', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource)
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
