import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create symbols table
    await queryRunner.query(`
      CREATE TABLE "symbols" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "symbol" character varying(20) NOT NULL,
        "exchange" character varying(50),
        "name" character varying(255),
        "industryCode" character varying(50),
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_symbols_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_symbols_symbol" UNIQUE ("symbol")
      )
    `);

    // Create index on symbol field
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_symbols_symbol" ON "symbols" ("symbol")
    `);

    // Create quote_daily table
    await queryRunner.query(`
      CREATE TABLE "quote_daily" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "symbolId" uuid NOT NULL,
        "date" date NOT NULL,
        "open" double precision NOT NULL,
        "high" double precision NOT NULL,
        "low" double precision NOT NULL,
        "close" double precision NOT NULL,
        "volume" character varying(50) NOT NULL,
        "source" character varying(50) NOT NULL,
        "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quote_daily_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quote_daily_symbolId_date_source" UNIQUE ("symbolId", "date", "source")
      )
    `);

    // Create index on symbolId and date
    await queryRunner.query(`
      CREATE INDEX "IDX_quote_daily_symbolId_date" ON "quote_daily" ("symbolId", "date")
    `);

    // Add foreign key constraint for quote_daily
    await queryRunner.query(`
      ALTER TABLE "quote_daily"
      ADD CONSTRAINT "FK_quote_daily_symbolId"
      FOREIGN KEY ("symbolId")
      REFERENCES "symbols"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    // Create quote_intraday table
    await queryRunner.query(`
      CREATE TABLE "quote_intraday" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "symbolId" uuid NOT NULL,
        "ts" TIMESTAMP WITH TIME ZONE NOT NULL,
        "price" double precision NOT NULL,
        "volume" character varying(50) NOT NULL,
        "source" character varying(50) NOT NULL,
        "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quote_intraday_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_quote_intraday_symbolId_ts_source" UNIQUE ("symbolId", "ts", "source")
      )
    `);

    // Create index on symbolId and ts
    await queryRunner.query(`
      CREATE INDEX "IDX_quote_intraday_symbolId_ts" ON "quote_intraday" ("symbolId", "ts")
    `);

    // Add foreign key constraint for quote_intraday
    await queryRunner.query(`
      ALTER TABLE "quote_intraday"
      ADD CONSTRAINT "FK_quote_intraday_symbolId"
      FOREIGN KEY ("symbolId")
      REFERENCES "symbols"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    // Create crawl_runs table with enum type
    await queryRunner.query(`
      CREATE TYPE "crawl_runs_status_enum" AS ENUM('RUNNING', 'SUCCESS', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TABLE "crawl_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "jobName" character varying(100) NOT NULL,
        "source" character varying(50) NOT NULL,
        "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endedAt" TIMESTAMP WITH TIME ZONE,
        "status" "crawl_runs_status_enum" NOT NULL,
        "errorText" text,
        "statsJson" jsonb,
        CONSTRAINT "PK_crawl_runs_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign key constraints)
    await queryRunner.query(`DROP TABLE "crawl_runs"`);
    await queryRunner.query(`DROP TYPE "crawl_runs_status_enum"`);
    
    await queryRunner.query(`ALTER TABLE "quote_intraday" DROP CONSTRAINT "FK_quote_intraday_symbolId"`);
    await queryRunner.query(`DROP INDEX "IDX_quote_intraday_symbolId_ts"`);
    await queryRunner.query(`DROP TABLE "quote_intraday"`);
    
    await queryRunner.query(`ALTER TABLE "quote_daily" DROP CONSTRAINT "FK_quote_daily_symbolId"`);
    await queryRunner.query(`DROP INDEX "IDX_quote_daily_symbolId_date"`);
    await queryRunner.query(`DROP TABLE "quote_daily"`);
    
    await queryRunner.query(`DROP INDEX "IDX_symbols_symbol"`);
    await queryRunner.query(`DROP TABLE "symbols"`);
  }
}
