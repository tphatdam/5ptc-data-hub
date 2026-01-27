import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface BulkUpsertNewsArticleDto {
  url: string;
  urlHash: string;
  publishedAt: Date | null;
  title: string;
  summary: string | null;
  content: string | null;
  tickers: string[] | null;
  tags: string[] | null;
  source: string;
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
      const baseIndex = index * 10;
      valuePlaceholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}::timestamptz, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}::text[], $${baseIndex + 8}::text[], $${baseIndex + 9}, $${baseIndex + 10}::timestamptz)`,
      );
      values.push(
        row.url,
        row.urlHash,
        row.publishedAt,
        row.title,
        row.summary,
        row.content,
        row.tickers,
        row.tags,
        row.source,
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
        content,
        tickers,
        tags,
        source,
        "fetchedAt"
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (source, "urlHash")
      DO UPDATE SET
        url = EXCLUDED.url,
        "publishedAt" = EXCLUDED."publishedAt",
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        content = EXCLUDED.content,
        tickers = EXCLUDED.tickers,
        tags = EXCLUDED.tags,
        "fetchedAt" = EXCLUDED."fetchedAt",
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);
    return chunk.length;
  }
}

