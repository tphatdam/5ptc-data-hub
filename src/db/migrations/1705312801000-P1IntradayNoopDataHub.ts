import { MigrationInterface, QueryRunner } from 'typeorm';

export class P1IntradayNoopDataHub1705312801000 implements MigrationInterface {
  name = 'P1IntradayNoopDataHub1705312801000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Intraday in data-hub stores aggregated candles, not tick-level trade metadata.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op rollback.
  }
}
