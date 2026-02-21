import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Symbol } from './symbol.entity';
import { DataSource } from './data-source.entity';

@Entity('company_report')
@Unique('UQ_company_report_symbol_file_source', ['symbolId', 'fileUrlHash', 'sourceId'])
@Index('IDX_company_report_symbol_report_type', ['symbolId', 'reportType'])
export class CompanyReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbolId: number;

  @ManyToOne(() => Symbol, (symbol) => symbol.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;

  @Column({ type: 'varchar', length: 50, name: 'report_type' })
  reportType: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title: string | null;

  @Column({ type: 'date', name: 'published_at', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'text', name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'char', length: 64, name: 'file_url_hash' })
  fileUrlHash: string;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
