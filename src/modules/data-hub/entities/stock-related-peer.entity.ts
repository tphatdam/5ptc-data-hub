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

@Entity('stock_related_peer')
@Unique('UQ_stock_related_peer_symbol_peer_source', ['symbolId', 'peerTicker', 'sourceId'])
@Index('IDX_stock_related_peer_symbol', ['symbolId'])
export class StockRelatedPeer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'symbol_id' })
  symbolId: number;

  @ManyToOne(() => Symbol, (symbol) => symbol.relatedPeers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;

  @Column({ type: 'varchar', length: 20, name: 'peer_ticker' })
  peerTicker: string;

  @Column({ type: 'varchar', length: 50, name: 'relation_type', nullable: true })
  relationType: string | null;

  @Column({ type: 'double precision', nullable: true })
  score: number | null;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
