import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Symbol } from './symbol.entity';

@Entity('company_subsidiaries')
@Unique(['parentSymbolId', 'subsidiaryName', 'source'])
export class CompanySubsidiary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  parentSymbolId: string;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'parentSymbolId' })
  parentSymbol: Symbol;

  @Column({ type: 'varchar', length: 255 })
  subsidiaryName: string;

  @Column({ type: 'double precision', nullable: true })
  ownershipPercent: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relationshipType: string | null;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}

