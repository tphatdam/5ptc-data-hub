import { MigrationInterface, QueryRunner } from 'typeorm';

export class P6CreateStockInsiderEvent1705312806000 implements MigrationInterface {
  name = 'P6CreateStockInsiderEvent1705312806000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_insider_event" (
        "id" SERIAL PRIMARY KEY,
        "symbol_id" INTEGER NOT NULL REFERENCES "symbol"("id"),
        "announce_date" DATE,
        "transaction_date" DATE NOT NULL,
        "insider_name" VARCHAR(255),
        "insider_role" VARCHAR(255),
        "related_person" VARCHAR(255),
        "action_type" VARCHAR(50),
        "deal_method" VARCHAR(100),
        "status" VARCHAR(50),
        "quantity_registered" BIGINT,
        "quantity_executed" BIGINT,
        "quantity_remaining" BIGINT,
        "price_from" NUMERIC(18,4),
        "price_to" NUMERIC(18,4),
        "avg_price" NUMERIC(18,4),
        "deal_value" NUMERIC(22,4),
        "ownership_before" NUMERIC(10,4),
        "ownership_after" NUMERIC(10,4),
        "ownership_change" NUMERIC(10,4),
        "source_event_id" VARCHAR(128),
        "source_url" TEXT,
        "raw_payload" JSONB,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stock_insider_event_core"
          UNIQUE (
            "symbol_id",
            "transaction_date",
            "insider_name",
            "action_type",
            "quantity_executed",
            "source_id"
          )
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_insider_event_symbol_transaction" ON "stock_insider_event" ("symbol_id", "transaction_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_insider_event_source_event_id" ON "stock_insider_event" ("source_id", "source_event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_insider_event_source_event_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_insider_event_symbol_transaction"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_insider_event"`);
  }
}
