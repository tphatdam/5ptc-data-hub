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
  subtitle: string;

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

  @Column({ type: 'varchar', length: 128, name: 'provider_news_id', nullable: true })
  providerNewsId: string;

  @Column({ type: 'varchar', length: 10, name: 'lang_code', nullable: true })
  langCode: string;

  @Column({ type: 'text', name: 'source_link', nullable: true })
  sourceLink: string;

  @Column({ type: 'text', name: 'news_image_url', nullable: true })
  newsImageUrl: string;

  @Column({ type: 'timestamptz', name: 'source_created_at', nullable: true })
  sourceCreatedAt: Date;

  @Column({ type: 'timestamptz', name: 'source_updated_at', nullable: true })
  sourceUpdatedAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
