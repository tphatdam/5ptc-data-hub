import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Symbol } from './symbol.entity';
import { DataSource } from './data-source.entity';

@Entity('stock_financial_statement_fact')
@Unique('UQ_stock_financial_statement_fact', [
  'symbolId',
  'statementType',
  'frequency',
  'periodYear',
  'periodQuarter',
  'metricCode',
  'sourceId',
])
@Index('IDX_stock_financial_statement_fact_symbol_period', [
  'symbolId',
  'statementType',
  'frequency',
  'periodYear',
])
@Index('IDX_stock_financial_statement_fact_source', ['sourceId'])
export class StockFinancialStatementFact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbolId: number;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;

  @Column({ type: 'varchar', length: 50, name: 'statement_type' })
  statementType: string;

  @Column({ type: 'varchar', length: 20 })
  frequency: string;

  @Column({ type: 'int', name: 'period_year' })
  periodYear: number;

  @Column({ type: 'int', name: 'period_quarter', nullable: true })
  periodQuarter: number | null;

  @Column({ type: 'varchar', length: 100, name: 'metric_code' })
  metricCode: string;

  @Column({ type: 'varchar', length: 255, name: 'metric_label', nullable: true })
  metricLabel: string | null;

  @Column({ type: 'numeric', precision: 22, scale: 4, nullable: true })
  value: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string | null;

  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'jsonb', name: 'raw_payload', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource)
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
