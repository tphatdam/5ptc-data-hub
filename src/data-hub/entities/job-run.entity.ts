import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';
import { JobStatus } from '../enums';

@Entity('job_run')
export class JobRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'job_name' })
  @Index()
  jobName: string;

  @Column({ type: 'timestamptz', name: 'scheduled_for', nullable: true })
  scheduledFor: Date;

  @Column({ type: 'timestamptz', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt: Date;

  @Column({
    type: 'enum',
    enum: JobStatus,
  })
  status: JobStatus;

  @Column({ type: 'int', default: 0 })
  items: number;

  @Column({ type: 'text', nullable: true })
  error: string;
}
