import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface BulkUpsertForeignTradingDailyDto {
  symbolId: string;
  date: Date;
  buyVolume: string | null;
  sellVolume: string | null;
  netVolume: string | null;
  source: string;
}

@Injectable()
export class ForeignTradingDailyRepository {
  private readonly logger = new Logger(ForeignTradingDailyRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async bulkUpsert(rows: BulkUpsertForeignTradingDailyDto[]): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const CHUNK_SIZE = 500;
    let totalUpserted = 0;

    try {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const upserted = await this.upsertChunk(chunk);
        totalUpserted += upserted;
      }

      this.logger.log(
        `Successfully upserted ${totalUpserted} foreign trading rows in ${Math.ceil(rows.length / CHUNK_SIZE)} chunk(s)`,
      );

      return totalUpserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to bulk upsert foreign trading rows: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async upsertChunk(chunk: BulkUpsertForeignTradingDailyDto[]): Promise<number> {
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    chunk.forEach((row, index) => {
      const baseIndex = index * 6;
      valuePlaceholders.push(
        `($${baseIndex + 1}::uuid, $${baseIndex + 2}::date, $${baseIndex + 3}::bigint, $${baseIndex + 4}::bigint, $${baseIndex + 5}::bigint, $${baseIndex + 6})`,
      );
      values.push(
        row.symbolId,
        row.date,
        row.buyVolume,
        row.sellVolume,
        row.netVolume,
        row.source,
      );
    });

    const sql = `
      INSERT INTO foreign_trading_daily (
        "symbolId",
        date,
        "buyVolume",
        "sellVolume",
        "netVolume",
        source
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("symbolId", date, source)
      DO UPDATE SET
        "buyVolume" = EXCLUDED."buyVolume",
        "sellVolume" = EXCLUDED."sellVolume",
        "netVolume" = EXCLUDED."netVolume",
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);
    return chunk.length;
  }
}

