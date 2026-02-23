import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockFinancialStatementFact1705312811000 implements MigrationInterface {
  name = 'CreateStockFinancialStatementFact1705312811000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_financial_statement_fact" (
        "id" SERIAL PRIMARY KEY,
        "symbol_id" INTEGER NOT NULL REFERENCES "symbol"("id"),
        "statement_type" VARCHAR(50) NOT NULL,
        "frequency" VARCHAR(20) NOT NULL,
        "period_year" INTEGER NOT NULL,
        "period_quarter" INTEGER,
        "metric_code" VARCHAR(100) NOT NULL,
        "metric_label" VARCHAR(255),
        "value" NUMERIC(22,4),
        "currency" VARCHAR(10),
        "published_at" TIMESTAMPTZ,
        "raw_payload" JSONB,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stock_financial_statement_fact"
          UNIQUE (
            "symbol_id",
            "statement_type",
            "frequency",
            "period_year",
            "period_quarter",
            "metric_code",
            "source_id"
          )
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_financial_statement_fact_symbol_period" ON "stock_financial_statement_fact" ("symbol_id", "statement_type", "frequency", "period_year")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_financial_statement_fact_source" ON "stock_financial_statement_fact" ("source_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_financial_statement_fact_source"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_financial_statement_fact_symbol_period"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_financial_statement_fact"`);
  }
}
