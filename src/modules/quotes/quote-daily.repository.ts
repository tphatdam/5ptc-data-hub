import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QuoteDaily } from '../../db/entities/quote-daily.entity';

export interface BulkUpsertQuoteDailyDto {
  symbolId: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
  source: string;
}

@Injectable()
export class QuoteDailyRepository {
  private readonly logger = new Logger(QuoteDailyRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Bulk upsert daily quotes using raw SQL with INSERT ... ON CONFLICT DO UPDATE.
   * Chunks operations into batches of 500 rows for efficiency.
   * Returns the total count of upserted rows.
   */
  async bulkUpsert(quotes: BulkUpsertQuoteDailyDto[]): Promise<number> {
    if (quotes.length === 0) {
      return 0;
    }

    const CHUNK_SIZE = 500;
    let totalUpserted = 0;

    try {
      // Process quotes in chunks of 500
      for (let i = 0; i < quotes.length; i += CHUNK_SIZE) {
        const chunk = quotes.slice(i, i + CHUNK_SIZE);
        const upsertedCount = await this.upsertChunk(chunk);
        totalUpserted += upsertedCount;
      }

      this.logger.log(
        `Successfully upserted ${totalUpserted} daily quotes in ${Math.ceil(quotes.length / CHUNK_SIZE)} chunk(s)`,
      );

      return totalUpserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to bulk upsert daily quotes: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Upsert a single chunk of quotes using raw SQL.
   * Uses INSERT ... ON CONFLICT (symbolId, date, source) DO UPDATE.
   */
  private async upsertChunk(chunk: BulkUpsertQuoteDailyDto[]): Promise<number> {
    // Build the VALUES clause with parameterized queries
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    chunk.forEach((quote, index) => {
      const baseIndex = index * 8;
      valuePlaceholders.push(
        `($${baseIndex + 1}::uuid, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`,
      );
      values.push(
        quote.symbolId,
        quote.date,
        quote.open,
        quote.high,
        quote.low,
        quote.close,
        quote.volume,
        quote.source,
      );
    });

    const sql = `
      INSERT INTO quote_daily (
        "symbolId",
        date,
        open,
        high,
        low,
        close,
        volume,
        source
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("symbolId", date, source)
      DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);

    return chunk.length;
  }

  /**
   * Find daily quotes by symbol ID and date range.
   * Returns quotes ordered by date ascending.
   */
  async findBySymbolAndDateRange(
    symbolId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<QuoteDaily[]> {
    try {
      const quotes = await this.dataSource
        .getRepository(QuoteDaily)
        .createQueryBuilder('quote')
        .where('quote.symbolId = :symbolId', { symbolId })
        .andWhere('quote.date >= :startDate', { startDate })
        .andWhere('quote.date <= :endDate', { endDate })
        .orderBy('quote.date', 'ASC')
        .getMany();

      this.logger.debug(
        `Found ${quotes.length} daily quotes for symbol ${symbolId} between ${startDate.toISOString()} and ${endDate.toISOString()}`,
      );

      return quotes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to find daily quotes for symbol ${symbolId}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }
}
