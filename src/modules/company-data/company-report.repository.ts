import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface BulkUpsertCompanyReportDto {
  symbolId: string;
  reportType: string;
  title: string | null;
  publishedAt: Date | null;
  fileUrl: string;
  fileUrlHash: string;
  source: string;
}

@Injectable()
export class CompanyReportRepository {
  private readonly logger = new Logger(CompanyReportRepository.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async bulkUpsert(rows: BulkUpsertCompanyReportDto[]): Promise<number> {
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
        `Successfully upserted ${totalUpserted} company reports in ${Math.ceil(rows.length / CHUNK_SIZE)} chunk(s)`,
      );

      return totalUpserted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to bulk upsert company reports: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private async upsertChunk(chunk: BulkUpsertCompanyReportDto[]): Promise<number> {
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    chunk.forEach((row, index) => {
      const baseIndex = index * 7;
      valuePlaceholders.push(
        `($${baseIndex + 1}::uuid, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}::date, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`,
      );
      values.push(
        row.symbolId,
        row.reportType,
        row.title,
        row.publishedAt,
        row.fileUrl,
        row.fileUrlHash,
        row.source,
      );
    });

    const sql = `
      INSERT INTO company_reports (
        "symbolId",
        "reportType",
        title,
        "publishedAt",
        "fileUrl",
        "fileUrlHash",
        source
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("symbolId", "fileUrlHash", source)
      DO UPDATE SET
        "reportType" = EXCLUDED."reportType",
        title = EXCLUDED.title,
        "publishedAt" = EXCLUDED."publishedAt",
        "fileUrl" = EXCLUDED."fileUrl",
        "ingestedAt" = CURRENT_TIMESTAMP
    `;

    await this.dataSource.query(sql, values);
    return chunk.length;
  }
}

