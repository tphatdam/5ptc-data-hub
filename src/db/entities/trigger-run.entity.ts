import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TriggerRunStep } from './trigger-run-step.entity';

export enum TriggerRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAIL = 'FAIL',
}

@Entity('trigger_run')
export class TriggerRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'full' })
  mode: string;

  @Column({ type: 'varchar', length: 20 })
  status: TriggerRunStatus;

  @Column({ type: 'timestamptz', name: 'accepted_at' })
  acceptedAt: Date;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'jsonb', name: 'summary_json', nullable: true })
  summaryJson: Record<string, any> | null;

  @Column({ type: 'text', name: 'error_text', nullable: true })
  errorText: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TriggerRunStep, (step) => step.run)
  steps: TriggerRunStep[];
}
