import { MigrationInterface, QueryRunner } from 'typeorm';

export class P7CreateCompanyDomainAndBackfillTables1705312807000
  implements MigrationInterface
{
  name = 'P7CreateCompanyDomainAndBackfillTables1705312807000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_related_peer" (
        "id" SERIAL PRIMARY KEY,
        "symbol_id" INTEGER NOT NULL REFERENCES "symbol"("id") ON DELETE CASCADE,
        "peer_ticker" VARCHAR(20) NOT NULL,
        "relation_type" VARCHAR(50),
        "score" DOUBLE PRECISION,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stock_related_peer_symbol_peer_source"
          UNIQUE ("symbol_id", "peer_ticker", "source_id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_related_peer_symbol" ON "stock_related_peer" ("symbol_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_subsidiary" (
        "id" SERIAL PRIMARY KEY,
        "parent_symbol_id" INTEGER NOT NULL REFERENCES "symbol"("id") ON DELETE CASCADE,
        "subsidiary_name" VARCHAR(255) NOT NULL,
        "ownership_percent" DOUBLE PRECISION,
        "relationship_type" VARCHAR(50),
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_company_subsidiary_parent_name_source"
          UNIQUE ("parent_symbol_id", "subsidiary_name", "source_id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_subsidiary_parent_symbol" ON "company_subsidiary" ("parent_symbol_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_report" (
        "id" SERIAL PRIMARY KEY,
        "symbol_id" INTEGER NOT NULL REFERENCES "symbol"("id") ON DELETE CASCADE,
        "report_type" VARCHAR(50) NOT NULL,
        "title" VARCHAR(500),
        "published_at" DATE,
        "file_url" TEXT NOT NULL,
        "file_url_hash" CHAR(64) NOT NULL,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_company_report_symbol_file_source"
          UNIQUE ("symbol_id", "file_url_hash", "source_id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_report_symbol_report_type" ON "company_report" ("symbol_id", "report_type")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "legacy_backfill_state" (
        "task_name" VARCHAR(100) PRIMARY KEY,
        "cursor" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "legacy_backfill_error" (
        "id" BIGSERIAL PRIMARY KEY,
        "task_name" VARCHAR(100) NOT NULL,
        "legacy_pk" TEXT,
        "reason" TEXT NOT NULL,
        "payload" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_legacy_backfill_error_task_created_at" ON "legacy_backfill_error" ("task_name", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_legacy_backfill_error_task_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "legacy_backfill_error"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "legacy_backfill_state"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_report_symbol_report_type"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "company_report"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_subsidiary_parent_symbol"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "company_subsidiary"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_related_peer_symbol"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_related_peer"`);
  }
}
