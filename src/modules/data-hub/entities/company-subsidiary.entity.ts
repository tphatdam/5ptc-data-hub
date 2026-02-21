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

@Entity('company_subsidiary')
@Unique('UQ_company_subsidiary_parent_name_source', [
  'parentSymbolId',
  'subsidiaryName',
  'sourceId',
])
@Index('IDX_company_subsidiary_parent_symbol', ['parentSymbolId'])
export class CompanySubsidiary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'parent_symbol_id' })
  parentSymbolId: number;

  @ManyToOne(() => Symbol, (symbol) => symbol.subsidiaries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_symbol_id' })
  parentSymbol: Symbol;

  @Column({ type: 'varchar', length: 255, name: 'subsidiary_name' })
  subsidiaryName: string;

  @Column({ type: 'double precision', name: 'ownership_percent', nullable: true })
  ownershipPercent: number | null;

  @Column({ type: 'varchar', length: 50, name: 'relationship_type', nullable: true })
  relationshipType: string | null;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
