import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyAndNewsTables1700100000000
  implements MigrationInterface
{
  name = 'AddCompanyAndNewsTables1700100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "foreign_trading_daily" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "symbolId" uuid NOT NULL,
        "date" date NOT NULL,
        "buyVolume" bigint,
        "sellVolume" bigint,
        "netVolume" bigint,
        "source" character varying(50) NOT NULL,
        "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_foreign_trading_daily_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_foreign_trading_daily_symbolId_date_source" UNIQUE ("symbolId", "date", "source")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_foreign_trading_daily_symbolId_date" ON "foreign_trading_daily" ("symbolId", "date")
    `);

    await queryRunner.query(`
      ALTER TABLE "foreign_trading_daily"
      ADD CONSTRAINT "FK_foreign_trading_daily_symbolId"
      FOREIGN KEY ("symbolId")
      REFERENCES "symbols"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "insider_trading_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "symbolId" uuid NOT NULL,
        "transactionDate" date NOT NULL,
        "insiderName" character varying(255),
        "insiderRole" character varying(255),
        "transactionType" character varying(50),
        "quantity" bigint,
        "price" double precision,
        "source" character varying(50) NOT NULL,
        "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_insider_trading_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_insider_trading_events_unique" UNIQUE ("symbolId", "transactionDate", "insiderName", "transactionType", "quantity", "price", "source")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_insider_trading_events_symbolId_transactionDate" ON "insider_trading_events" ("symbolId", "transactionDate")
    `);

    await queryRunner.query(`
      ALTER TABLE "insider_trading_events"
      ADD CONSTRAINT "FK_insider_trading_events_symbolId"
      FOREIGN KEY ("symbolId")
      REFERENCES "symbols"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "stock_related_peers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "symbolId" uuid NOT NULL,
        "peerTicker" character varying(20) NOT NULL,
        "relationType" character varying(50),
        "score" double precision,
        "source" character varying(50) NOT NULL,
        "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_related_peers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_stock_related_peers_symbolId_peerTicker_source" UNIQUE ("symbolId", "peerTicker", "source")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_related_peers"
      ADD CONSTRAINT "FK_stock_related_peers_symbolId"
      FOREIGN KEY ("symbolId")
      REFERENCES "symbols"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "company_subsidiaries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "parentSymbolId" uuid NOT NULL,
        "subsidiaryName" character varying(255) NOT NULL,
        "ownershipPercent" double precision,
        "relationshipType" character varying(50),
        "source" character varying(50) NOT NULL,
        "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_subsidiaries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_subsidiaries_parentSymbolId_subsidiaryName_source" UNIQUE ("parentSymbolId", "subsidiaryName", "source")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "company_subsidiaries"
      ADD CONSTRAINT "FK_company_subsidiaries_parentSymbolId"
      FOREIGN KEY ("parentSymbolId")
      REFERENCES "symbols"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "news_articles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "url" text NOT NULL,
        "urlHash" character(64) NOT NULL,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "title" text NOT NULL,
        "summary" text,
        "content" text,
        "tickers" text[],
        "tags" text[],
        "source" character varying(50) NOT NULL,
        "fetchedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_news_articles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_news_articles_source_urlHash" UNIQUE ("source", "urlHash")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_news_articles_publishedAt" ON "news_articles" ("publishedAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_news_articles_tickers_gin" ON "news_articles" USING GIN ("tickers")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_news_articles_tags_gin" ON "news_articles" USING GIN ("tags")
    `);

    await queryRunner.query(`
      CREATE TABLE "company_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "symbolId" uuid NOT NULL,
        "reportType" character varying(50) NOT NULL,
        "title" character varying(500),
        "publishedAt" date,
        "fileUrl" text NOT NULL,
        "fileUrlHash" character(64) NOT NULL,
        "source" character varying(50) NOT NULL,
        "ingestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_reports_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_reports_symbolId_fileUrlHash_source" UNIQUE ("symbolId", "fileUrlHash", "source")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_company_reports_symbolId_reportType" ON "company_reports" ("symbolId", "reportType")
    `);

    await queryRunner.query(`
      ALTER TABLE "company_reports"
      ADD CONSTRAINT "FK_company_reports_symbolId"
      FOREIGN KEY ("symbolId")
      REFERENCES "symbols"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_reports" DROP CONSTRAINT "FK_company_reports_symbolId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_company_reports_symbolId_reportType"`,
    );
    await queryRunner.query(`DROP TABLE "company_reports"`);

    await queryRunner.query(`DROP INDEX "IDX_news_articles_tags_gin"`);
    await queryRunner.query(`DROP INDEX "IDX_news_articles_tickers_gin"`);
    await queryRunner.query(`DROP INDEX "IDX_news_articles_publishedAt"`);
    await queryRunner.query(`DROP TABLE "news_articles"`);

    await queryRunner.query(
      `ALTER TABLE "company_subsidiaries" DROP CONSTRAINT "FK_company_subsidiaries_parentSymbolId"`,
    );
    await queryRunner.query(`DROP TABLE "company_subsidiaries"`);

    await queryRunner.query(
      `ALTER TABLE "stock_related_peers" DROP CONSTRAINT "FK_stock_related_peers_symbolId"`,
    );
    await queryRunner.query(`DROP TABLE "stock_related_peers"`);

    await queryRunner.query(
      `ALTER TABLE "insider_trading_events" DROP CONSTRAINT "FK_insider_trading_events_symbolId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_insider_trading_events_symbolId_transactionDate"`,
    );
    await queryRunner.query(`DROP TABLE "insider_trading_events"`);

    await queryRunner.query(
      `ALTER TABLE "foreign_trading_daily" DROP CONSTRAINT "FK_foreign_trading_daily_symbolId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_foreign_trading_daily_symbolId_date"`,
    );
    await queryRunner.query(`DROP TABLE "foreign_trading_daily"`);
  }
}

