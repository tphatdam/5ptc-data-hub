import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum InvestmentRecommendation {
  HOLD = 'Giữ',
  BUY = 'Mua',
  SELL = 'Bán',
}

@Entity('daily_stock_report')
@Index('idx_stock_reportdate', ['stock', 'reportDate'], { unique: true })
export class DailyStockReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  stock: string;

  @Column({ type: 'date' })
  reportDate: Date;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string | null; // Now stores PDF URL instead of HTML URL, nullable for placeholder rows

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfUrl: string | null; // Deprecated - kept for backwards compatibility

  @Column({ type: 'boolean', default: false })
  notificationSent: boolean;

  @Column({ type: 'enum', enum: InvestmentRecommendation, nullable: true })
  investmentRecommendation?: InvestmentRecommendation;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
