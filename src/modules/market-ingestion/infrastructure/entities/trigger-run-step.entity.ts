import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TriggerRun } from './trigger-run.entity';

export enum TriggerRunStepStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAIL = 'FAIL',
  SKIP = 'SKIP',
}

@Entity('trigger_run_step')
@Index(['runId', 'sequence'])
export class TriggerRunStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'run_id' })
  runId: string;

  @ManyToOne(() => TriggerRun, (run) => run.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run: TriggerRun;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'varchar', length: 100 })
  step: string;

  @Column({ type: 'varchar', length: 20 })
  status: TriggerRunStepStatus;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'text', name: 'error_text', nullable: true })
  errorText: string | null;

  @Column({ type: 'jsonb', name: 'meta_json', nullable: true })
  metaJson: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
