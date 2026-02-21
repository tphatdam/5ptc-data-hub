import { MigrationInterface, QueryRunner } from 'typeorm';

export class P3CreateStockForeignTradingDaily1705312803000
  implements MigrationInterface
{
  name = 'P3CreateStockForeignTradingDaily1705312803000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_foreign_trading_daily" (
        "id" SERIAL PRIMARY KEY,
        "symbol_id" INTEGER NOT NULL REFERENCES "symbol"("id"),
        "trade_date" DATE NOT NULL,
        "buy_volume" BIGINT,
        "sell_volume" BIGINT,
        "net_volume" BIGINT,
        "buy_value" NUMERIC(22,4),
        "sell_value" NUMERIC(22,4),
        "net_value" NUMERIC(22,4),
        "foreign_room" BIGINT,
        "foreign_holding_room" BIGINT,
        "current_holding_ratio" NUMERIC(10,4),
        "max_holding_ratio" NUMERIC(10,4),
        "raw_payload" JSONB,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stock_foreign_trading_daily_symbol_trade_date_source"
          UNIQUE ("symbol_id", "trade_date", "source_id")
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_foreign_trading_daily_symbol_trade_date" ON "stock_foreign_trading_daily" ("symbol_id", "trade_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_foreign_trading_daily_symbol_trade_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_foreign_trading_daily"`);
  }
}
