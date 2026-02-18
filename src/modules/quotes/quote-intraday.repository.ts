import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QuoteIntraday } from '../../db/entities/quote-intraday.entity';

export interface BulkUpsertQuoteIntradayDto {
  symbolId: string;
  ts: Date;
  price: number;
  volume: string;
  source: string;
}

@Injectable()
export class QuoteIntradayRepository {
  private readonly logger = new Logger(QuoteIntradayRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Bulk upsert intraday quotes using raw SQL with INSERT ... ON CONFLICT DO UPDATE.
   * Chunks operations into batches of 500 rows for efficiency.
   * Returns the total count of upserted rows.
   */
  async bulkUpsert(quotes: BulkUpsertQuoteIntradayDto[]): Promise<number> {
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
        `Successfully upserted ${totalUpserted} intraday quotes in ${Math.ceil(quotes.length / CHUNK_SIZE)} chunk(s)`,
      );

      return totalUpserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to bulk upsert intraday quotes: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Upsert a single chunk of quotes using raw SQL.
   * Uses INSERT ... ON CONFLICT (symbolId, ts, source) DO UPDATE.
   */
  private async upsertChunk(chunk: BulkUpsertQuoteIntradayDto[]): Promise<number> {
    // Build the VALUES clause with parameterized queries
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    chunk.forEach((quote, index) => {
      const baseIndex = index * 5;
      valuePlaceholders.push(
        `($${baseIndex + 1}::uuid, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`,
      );
      values.push(
        quote.symbolId,
        quote.ts,
        quote.price,
        quote.volume,
        quote.source,
      );
    });

    const sql = `
      INSERT INTO quote_intraday (
        "symbolId",
        ts,
        price,
        volume,
        source
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("symbolId", ts, source)
      DO UPDATE SET
        price = EXCLUDED.price,
        volume = EXCLUDED.volume,
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);

    return chunk.length;
  }

  /**
   * Find intraday quotes by symbol ID and timestamp range.
   * Returns quotes ordered by timestamp ascending, limited to the specified limit.
   */
  async findBySymbolAndTimeRange(
    symbolId: string,
    startTs: Date,
    endTs: Date,
    limit: number = 2000,
  ): Promise<QuoteIntraday[]> {
    try {
      const quotes = await this.dataSource
        .getRepository(QuoteIntraday)
        .createQueryBuilder('quote')
        .where('quote.symbolId = :symbolId', { symbolId })
        .andWhere('quote.ts >= :startTs', { startTs })
        .andWhere('quote.ts <= :endTs', { endTs })
        .orderBy('quote.ts', 'ASC')
        .limit(limit)
        .getMany();

      this.logger.debug(
        `Found ${quotes.length} intraday quotes for symbol ${symbolId} between ${startTs.toISOString()} and ${endTs.toISOString()} (limit: ${limit})`,
      );

      return quotes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to find intraday quotes for symbol ${symbolId}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }
}
