import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface BulkUpsertCompanySubsidiaryDto {
  parentSymbolId: string;
  subsidiaryName: string;
  ownershipPercent: number | null;
  relationshipType: string | null;
  source: string;
}

@Injectable()
export class CompanySubsidiaryRepository {
  private readonly logger = new Logger(CompanySubsidiaryRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async bulkUpsert(rows: BulkUpsertCompanySubsidiaryDto[]): Promise<number> {
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
        `Successfully upserted ${totalUpserted} subsidiaries rows in ${Math.ceil(rows.length / CHUNK_SIZE)} chunk(s)`,
      );

      return totalUpserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to bulk upsert subsidiaries rows: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async upsertChunk(chunk: BulkUpsertCompanySubsidiaryDto[]): Promise<number> {
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    chunk.forEach((row, index) => {
      const baseIndex = index * 5;
      valuePlaceholders.push(
        `($${baseIndex + 1}::uuid, $${baseIndex + 2}, $${baseIndex + 3}::double precision, $${baseIndex + 4}, $${baseIndex + 5})`,
      );
      values.push(
        row.parentSymbolId,
        row.subsidiaryName,
        row.ownershipPercent,
        row.relationshipType,
        row.source,
      );
    });

    const sql = `
      INSERT INTO company_subsidiaries (
        "parentSymbolId",
        "subsidiaryName",
        "ownershipPercent",
        "relationshipType",
        source
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("parentSymbolId", "subsidiaryName", source)
      DO UPDATE SET
        "ownershipPercent" = EXCLUDED."ownershipPercent",
        "relationshipType" = EXCLUDED."relationshipType",
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);
    return chunk.length;
  }
}

