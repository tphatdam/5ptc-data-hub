import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface BulkUpsertStockRelatedPeerDto {
  symbolId: string;
  peerTicker: string;
  relationType: string | null;
  score: number | null;
  source: string;
}

@Injectable()
export class StockRelatedPeerRepository {
  private readonly logger = new Logger(StockRelatedPeerRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async bulkUpsert(rows: BulkUpsertStockRelatedPeerDto[]): Promise<number> {
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
        `Successfully upserted ${totalUpserted} related peer rows in ${Math.ceil(rows.length / CHUNK_SIZE)} chunk(s)`,
      );

      return totalUpserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to bulk upsert related peer rows: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async upsertChunk(chunk: BulkUpsertStockRelatedPeerDto[]): Promise<number> {
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    chunk.forEach((row, index) => {
      const baseIndex = index * 5;
      valuePlaceholders.push(
        `($${baseIndex + 1}::uuid, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}::double precision, $${baseIndex + 5})`,
      );
      values.push(row.symbolId, row.peerTicker, row.relationType, row.score, row.source);
    });

    const sql = `
      INSERT INTO stock_related_peers (
        "symbolId",
        "peerTicker",
        "relationType",
        score,
        source
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("symbolId", "peerTicker", source)
      DO UPDATE SET
        "relationType" = EXCLUDED."relationType",
        score = EXCLUDED.score,
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);
    return chunk.length;
  }
}

