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

@Entity('company_reports')
@Unique(['symbolId', 'fileUrlHash', 'source'])
@Index(['symbolId', 'reportType'])
export class CompanyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  symbolId: string;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbolId' })
  symbol: Symbol;

  @Column({ type: 'varchar', length: 50 })
  reportType: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title: string | null;

  @Column({ type: 'date', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'text' })
  fileUrl: string;

  @Column({ type: 'char', length: 64 })
  fileUrlHash: string;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}

