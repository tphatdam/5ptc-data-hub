import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDataHubSchema1705312800000 implements MigrationInterface {
  name = 'CreateDataHubSchema1705312800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "data_source_type_enum" AS ENUM('MARKET', 'NEWS', 'GOLD');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "candle_interval_enum" AS ENUM('1d', '15m');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "gold_provider_enum" AS ENUM('SJC', 'DOJI', 'PNJ');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "job_status_enum" AS ENUM('SUCCESS', 'FAIL', 'SKIP');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "data_source" (
        "id" SERIAL PRIMARY KEY,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(255) NOT NULL,
        "base_url" VARCHAR(500),
        "type" "data_source_type_enum" NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_data_source_code" ON "data_source" ("code");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "exchange" (
        "id" SERIAL PRIMARY KEY,
        "code" VARCHAR(20) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_exchange_code" ON "exchange" ("code");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "symbol" (
        "id" SERIAL PRIMARY KEY,
        "ticker" VARCHAR(20) NOT NULL UNIQUE,
        "exchange_id" INTEGER NOT NULL REFERENCES "exchange"("id"),
        "company_name" VARCHAR(255),
        "industry" VARCHAR(100),
        "isin" VARCHAR(20),
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "listed_at" DATE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_symbol_ticker" ON "symbol" ("ticker");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_index" (
        "id" SERIAL PRIMARY KEY,
        "code" VARCHAR(50) NOT NULL UNIQUE,
        "name" VARCHAR(100) NOT NULL,
        "exchange_id" INTEGER REFERENCES "exchange"("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_market_index_code" ON "market_index" ("code");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "index_candle" (
        "id" SERIAL PRIMARY KEY,
        "index_id" INTEGER NOT NULL REFERENCES "market_index"("id"),
        "interval" "candle_interval_enum" NOT NULL,
        "ts" TIMESTAMPTZ NOT NULL,
        "open" NUMERIC(18,4) NOT NULL,
        "high" NUMERIC(18,4) NOT NULL,
        "low" NUMERIC(18,4) NOT NULL,
        "close" NUMERIC(18,4) NOT NULL,
        "volume" BIGINT,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_index_candle_index_interval_ts" UNIQUE ("index_id", "interval", "ts")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_index_candle_index_ts" ON "index_candle" ("index_id", "ts");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_candle" (
        "id" SERIAL PRIMARY KEY,
        "symbol_id" INTEGER NOT NULL REFERENCES "symbol"("id"),
        "interval" "candle_interval_enum" NOT NULL,
        "ts" TIMESTAMPTZ NOT NULL,
        "open" NUMERIC(18,4) NOT NULL,
        "high" NUMERIC(18,4) NOT NULL,
        "low" NUMERIC(18,4) NOT NULL,
        "close" NUMERIC(18,4) NOT NULL,
        "volume" BIGINT NOT NULL,
        "value" NUMERIC(22,4),
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stock_candle_symbol_interval_ts" UNIQUE ("symbol_id", "interval", "ts")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stock_candle_symbol_ts" ON "stock_candle" ("symbol_id", "ts");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_snapshot" (
        "id" SERIAL PRIMARY KEY,
        "symbol_id" INTEGER NOT NULL REFERENCES "symbol"("id"),
        "as_of" TIMESTAMPTZ NOT NULL,
        "pe" NUMERIC(10,4),
        "eps" NUMERIC(18,4),
        "market_cap" NUMERIC(22,4),
        "free_float" NUMERIC(10,4),
        "shares_out" BIGINT,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_stock_snapshot_symbol_as_of" UNIQUE ("symbol_id", "as_of")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gold_price" (
        "id" SERIAL PRIMARY KEY,
        "provider" "gold_provider_enum" NOT NULL,
        "as_of" DATE NOT NULL,
        "buy" NUMERIC(18,2) NOT NULL,
        "sell" NUMERIC(18,2) NOT NULL,
        "raw" JSONB,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_gold_price_provider_as_of" UNIQUE ("provider", "as_of")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "news_article" (
        "id" SERIAL PRIMARY KEY,
        "source_id" INTEGER NOT NULL REFERENCES "data_source"("id"),
        "url" TEXT NOT NULL,
        "url_hash" CHAR(64) NOT NULL,
        "published_at" TIMESTAMPTZ,
        "title" TEXT NOT NULL,
        "summary" TEXT,
        "content" TEXT,
        "tickers" TEXT[],
        "tags" TEXT[],
        "fetched_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_news_article_source_url_hash" UNIQUE ("source_id", "url_hash")
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_news_article_published_at" ON "news_article" ("published_at");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_news_article_tickers" ON "news_article" USING GIN ("tickers");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_news_article_tags" ON "news_article" USING GIN ("tags");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_run" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "job_name" VARCHAR(100) NOT NULL,
        "scheduled_for" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "status" "job_status_enum" NOT NULL,
        "items" INTEGER NOT NULL DEFAULT 0,
        "error" TEXT
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_job_run_job_name" ON "job_run" ("job_name");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "job_run" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "news_article" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gold_price" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_snapshot" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_candle" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "index_candle" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "market_index" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "symbol" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "exchange" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "data_source" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gold_provider_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "candle_interval_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "data_source_type_enum";`);
  }
}
