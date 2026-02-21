import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('legacy_backfill_state')
export class LegacyBackfillState {
  @PrimaryColumn({ type: 'varchar', length: 100, name: 'task_name' })
  taskName: string;

  @Column({ type: 'text', nullable: true })
  cursor: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
