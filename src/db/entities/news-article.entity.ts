import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('news_articles')
@Unique(['source', 'urlHash'])
@Index(['publishedAt'])
export class NewsArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'char', length: 64 })
  urlHash: string;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  tickers: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  providerNewsId: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  languageCode: string | null;

  @Column({ type: 'text', nullable: true })
  sourceLink: string | null;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sourceCreatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sourceUpdatedAt: Date | null;

  @Column({ type: 'timestamptz' })
  fetchedAt: Date;

  @CreateDateColumn()
  ingestedAt: Date;
}
