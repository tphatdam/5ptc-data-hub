import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface BulkUpsertNewsArticleDto {
  url: string;
  urlHash: string;
  publishedAt: Date | null;
  title: string;
  summary: string | null;
  subtitle?: string | null;
  content: string | null;
  tickers: string[] | null;
  tags: string[] | null;
  source: string;
  providerNewsId?: string | null;
  languageCode?: string | null;
  sourceLink?: string | null;
  imageUrl?: string | null;
  sourceCreatedAt?: Date | null;
  sourceUpdatedAt?: Date | null;
  fetchedAt: Date;
}

@Injectable()
export class NewsArticleRepository {
  private readonly logger = new Logger(NewsArticleRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async bulkUpsert(rows: BulkUpsertNewsArticleDto[]): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const CHUNK_SIZE = 500;
    let totalUpserted = 0;

    try {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        totalUpserted += await this.upsertChunk(chunk);
      }

      this.logger.log(
        `Successfully upserted ${totalUpserted} news articles in ${Math.ceil(rows.length / CHUNK_SIZE)} chunk(s)`,
      );

      return totalUpserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to bulk upsert news articles: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async upsertChunk(chunk: BulkUpsertNewsArticleDto[]): Promise<number> {
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    chunk.forEach((row, index) => {
      const baseIndex = index * 17;
      valuePlaceholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}::timestamptz, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}::text[], $${baseIndex + 9}::text[], $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}::timestamptz, $${baseIndex + 16}::timestamptz, $${baseIndex + 17}::timestamptz)`,
      );
      values.push(
        row.url,
        row.urlHash,
        row.publishedAt,
        row.title,
        row.summary,
        row.subtitle ?? null,
        row.content,
        row.tickers,
        row.tags,
        row.source,
        row.providerNewsId ?? null,
        row.languageCode ?? null,
        row.sourceLink ?? null,
        row.imageUrl ?? null,
        row.sourceCreatedAt ?? null,
        row.sourceUpdatedAt ?? null,
        row.fetchedAt,
      );
    });

    const sql = `
      INSERT INTO news_articles (
        url,
        "urlHash",
        "publishedAt",
        title,
        summary,
        subtitle,
        content,
        tickers,
        tags,
        source,
        "providerNewsId",
        "languageCode",
        "sourceLink",
        "imageUrl",
        "sourceCreatedAt",
        "sourceUpdatedAt",
        "fetchedAt"
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (source, "urlHash")
      DO UPDATE SET
        url = EXCLUDED.url,
        "publishedAt" = EXCLUDED."publishedAt",
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        subtitle = COALESCE(EXCLUDED.subtitle, news_articles.subtitle),
        content = EXCLUDED.content,
        tickers = EXCLUDED.tickers,
        tags = EXCLUDED.tags,
        "providerNewsId" = COALESCE(EXCLUDED."providerNewsId", news_articles."providerNewsId"),
        "languageCode" = COALESCE(EXCLUDED."languageCode", news_articles."languageCode"),
        "sourceLink" = COALESCE(EXCLUDED."sourceLink", news_articles."sourceLink"),
        "imageUrl" = COALESCE(EXCLUDED."imageUrl", news_articles."imageUrl"),
        "sourceCreatedAt" = COALESCE(EXCLUDED."sourceCreatedAt", news_articles."sourceCreatedAt"),
        "sourceUpdatedAt" = COALESCE(EXCLUDED."sourceUpdatedAt", news_articles."sourceUpdatedAt"),
        "fetchedAt" = EXCLUDED."fetchedAt",
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);
    return chunk.length;
  }
}
