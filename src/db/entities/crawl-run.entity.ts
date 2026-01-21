import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

export enum CrawlRunStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('crawl_runs')
export class CrawlRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  jobName: string;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'enum', enum: CrawlRunStatus })
  status: CrawlRunStatus;

  @Column({ type: 'text', nullable: true })
  errorText: string | null;

  @Column({ type: 'jsonb', nullable: true })
  statsJson: Record<string, any> | null;
}
