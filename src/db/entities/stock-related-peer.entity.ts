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

@Entity('stock_related_peers')
@Unique(['symbolId', 'peerTicker', 'source'])
export class StockRelatedPeer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  symbolId: string;

  @ManyToOne(() => Symbol)
  @JoinColumn({ name: 'symbolId' })
  symbol: Symbol;

  @Column({ type: 'varchar', length: 20 })
  peerTicker: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relationType: string | null;

  @Column({ type: 'double precision', nullable: true })
  score: number | null;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}

