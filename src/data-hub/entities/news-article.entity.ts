import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { DataSource } from './data-source.entity';

@Entity('news_article')
@Unique('UQ_news_article_source_url_hash', ['sourceId', 'urlHash'])
export class NewsArticle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'source_id' })
  sourceId: number;

  @ManyToOne(() => DataSource)
  @JoinColumn({ name: 'source_id' })
  source: DataSource;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'char', length: 64, name: 'url_hash' })
  urlHash: string;

  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  @Index()
  publishedAt: Date;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', array: true, nullable: true })
  @Index('IDX_news_article_tickers', { synchronize: false })
  tickers: string[];

  @Column({ type: 'text', array: true, nullable: true })
  @Index('IDX_news_article_tags', { synchronize: false })
  tags: string[];

  @Column({ type: 'timestamptz', name: 'fetched_at' })
  fetchedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
