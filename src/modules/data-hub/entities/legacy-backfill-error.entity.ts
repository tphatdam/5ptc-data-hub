import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('legacy_backfill_error')
@Index('IDX_legacy_backfill_error_task_created_at', ['taskName', 'createdAt'])
export class LegacyBackfillError {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'task_name' })
  taskName: string;

  @Column({ type: 'text', name: 'legacy_pk', nullable: true })
  legacyPk: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
