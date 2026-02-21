import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface BulkUpsertInsiderTradingEventDto {
  symbolId: string;
  transactionDate: Date;
  announceDate?: Date | null;
  insiderName: string | null;
  insiderRole: string | null;
  transactionType: string | null;
  dealMethod?: string | null;
  actionType?: string | null;
  quantity: string | null;
  price: number | null;
  ownershipRatio?: string | null;
  source: string;
}

@Injectable()
export class InsiderTradingEventRepository {
  private readonly logger = new Logger(InsiderTradingEventRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async bulkUpsert(rows: BulkUpsertInsiderTradingEventDto[]): Promise<number> {
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
        `Successfully upserted ${totalUpserted} insider trading rows in ${Math.ceil(rows.length / CHUNK_SIZE)} chunk(s)`,
      );

      return totalUpserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to bulk upsert insider trading rows: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  private async upsertChunk(chunk: BulkUpsertInsiderTradingEventDto[]): Promise<number> {
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    chunk.forEach((row, index) => {
      const baseIndex = index * 12;
      valuePlaceholders.push(
        `($${baseIndex + 1}::uuid, $${baseIndex + 2}::date, $${baseIndex + 3}::date, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}::bigint, $${baseIndex + 10}::double precision, $${baseIndex + 11}::numeric, $${baseIndex + 12})`,
      );
      values.push(
        row.symbolId,
        row.transactionDate,
        row.announceDate ?? null,
        row.insiderName,
        row.insiderRole,
        row.transactionType,
        row.dealMethod ?? null,
        row.actionType ?? null,
        row.quantity,
        row.price,
        row.ownershipRatio ?? null,
        row.source,
      );
    });

    const sql = `
      INSERT INTO insider_trading_events (
        "symbolId",
        "transactionDate",
        "announceDate",
        "insiderName",
        "insiderRole",
        "transactionType",
        "dealMethod",
        "actionType",
        quantity,
        price,
        "ownershipRatio",
        source
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("symbolId", "transactionDate", "insiderName", "transactionType", quantity, price, source)
      DO UPDATE SET
        "announceDate" = COALESCE(EXCLUDED."announceDate", insider_trading_events."announceDate"),
        "insiderRole" = EXCLUDED."insiderRole",
        "dealMethod" = COALESCE(EXCLUDED."dealMethod", insider_trading_events."dealMethod"),
        "actionType" = COALESCE(EXCLUDED."actionType", insider_trading_events."actionType"),
        "ownershipRatio" = COALESCE(EXCLUDED."ownershipRatio", insider_trading_events."ownershipRatio"),
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);
    return chunk.length;
  }
}
