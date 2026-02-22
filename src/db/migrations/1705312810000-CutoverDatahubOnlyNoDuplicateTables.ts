import { MigrationInterface, QueryRunner } from 'typeorm';

type RelKindRow = { relkind: string };

export class CutoverDatahubOnlyNoDuplicateTables1705312810000
  implements MigrationInterface
{
  name = 'CutoverDatahubOnlyNoDuplicateTables1705312810000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "legacy_symbol_id_map" (
        "legacy_symbol_id" uuid PRIMARY KEY,
        "symbol_id" integer NOT NULL REFERENCES "symbol"("id") ON DELETE CASCADE,
        "mapped_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_legacy_symbol_id_map_symbol_id"
      ON "legacy_symbol_id_map" ("symbol_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cutover_source_fallback_audit" (
        "id" bigserial PRIMARY KEY,
        "table_name" varchar(100) NOT NULL,
        "legacy_source" text NOT NULL,
        "fallback_code" varchar(50) NOT NULL,
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cutover_source_fallback_audit"
      ON "cutover_source_fallback_audit" ("table_name", "legacy_source", "fallback_code");
    `);

    await queryRunner.query(`
      INSERT INTO "data_source" ("code", "name", "base_url", "type", "is_active")
      VALUES
        ('TCBS_API', 'TCBS Securities API', 'https://apipubaws.tcbs.com.vn', 'MARKET', true),
        ('SIMPLIZE_API', 'Simplize API', 'https://api2.simplize.vn', 'MARKET', true),
        ('SSI_API', 'SSI Securities API', 'https://iboard.ssi.com.vn', 'MARKET', true),
        ('VNDIRECT_HTML', 'VNDirect Web Scraper', 'https://www.vndirect.com.vn', 'MARKET', true),
        ('CAFEF_HTML', 'CafeF News Scraper', 'https://cafef.vn', 'NEWS', true),
        ('VNAPPMOB_GOLD', 'VN App Mobile Gold API', 'https://api.vnappmob.com', 'GOLD', true),
        ('SJC_HTML', 'SJC Gold Price', 'https://sjc.com.vn', 'GOLD', true)
      ON CONFLICT ("code") DO UPDATE
      SET
        "name" = EXCLUDED."name",
        "base_url" = EXCLUDED."base_url",
        "type" = EXCLUDED."type",
        "is_active" = EXCLUDED."is_active";
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "__cutover_map_source_code"(raw_source text, fallback_code text)
      RETURNS text
      LANGUAGE SQL
      IMMUTABLE
      STRICT
      AS $$
        SELECT CASE
          WHEN UPPER(raw_source) LIKE '%SIMPLIZE%' THEN 'SIMPLIZE_API'
          WHEN UPPER(raw_source) LIKE '%TCBS%' THEN 'TCBS_API'
          WHEN UPPER(raw_source) LIKE '%SSI%' THEN 'SSI_API'
          WHEN UPPER(raw_source) LIKE '%VNDIRECT%' THEN 'VNDIRECT_HTML'
          WHEN UPPER(raw_source) LIKE '%CAFEF%' THEN 'CAFEF_HTML'
          WHEN UPPER(raw_source) LIKE '%VNAPPMOB%' THEN 'VNAPPMOB_GOLD'
          WHEN UPPER(raw_source) LIKE '%SJC%' THEN 'SJC_HTML'
          ELSE fallback_code
        END
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "__cutover_source_uses_fallback"(raw_source text)
      RETURNS boolean
      LANGUAGE SQL
      IMMUTABLE
      AS $$
        SELECT CASE
          WHEN raw_source IS NULL OR btrim(raw_source) = '' THEN true
          WHEN UPPER(raw_source) LIKE '%SIMPLIZE%' THEN false
          WHEN UPPER(raw_source) LIKE '%TCBS%' THEN false
          WHEN UPPER(raw_source) LIKE '%SSI%' THEN false
          WHEN UPPER(raw_source) LIKE '%VNDIRECT%' THEN false
          WHEN UPPER(raw_source) LIKE '%CAFEF%' THEN false
          WHEN UPPER(raw_source) LIKE '%VNAPPMOB%' THEN false
          WHEN UPPER(raw_source) LIKE '%SJC%' THEN false
          ELSE true
        END
      $$;
    `);

    const legacySymbolsTable = await this.resolveLegacyTableName(queryRunner, 'symbols');
    if (legacySymbolsTable) {
      const legacySymbolsTableRef = this.quoteIdentifier(legacySymbolsTable);

      await queryRunner.query(`
        INSERT INTO "exchange" ("code", "name")
        SELECT DISTINCT
          CASE
            WHEN UPPER(COALESCE(s."exchange", '')) IN ('HSX', 'HOSE') THEN 'HOSE'
            WHEN UPPER(COALESCE(s."exchange", '')) = 'HNX' THEN 'HNX'
            WHEN UPPER(COALESCE(s."exchange", '')) IN ('UPCOM', 'UPCO') THEN 'UPCOM'
            ELSE 'UPCOM'
          END AS "code",
          CASE
            WHEN UPPER(COALESCE(s."exchange", '')) IN ('HSX', 'HOSE') THEN 'Ho Chi Minh Stock Exchange'
            WHEN UPPER(COALESCE(s."exchange", '')) = 'HNX' THEN 'Hanoi Stock Exchange'
            WHEN UPPER(COALESCE(s."exchange", '')) IN ('UPCOM', 'UPCO') THEN 'Unlisted Public Company Market'
            ELSE 'Unlisted Public Company Market'
          END AS "name"
        FROM ${legacySymbolsTableRef} s
        WHERE s."symbol" IS NOT NULL
        ON CONFLICT ("code") DO NOTHING;
      `);

      await queryRunner.query(`
        INSERT INTO "symbol" (
          "ticker",
          "exchange_id",
          "company_name",
          "industry",
          "is_active",
          "created_at",
          "updated_at"
        )
        SELECT
          UPPER(s."symbol") AS "ticker",
          e."id" AS "exchange_id",
          NULLIF(s."name", '') AS "company_name",
          NULLIF(s."industryCode", '') AS "industry",
          CASE WHEN UPPER(COALESCE(s."status", 'ACTIVE')) = 'INACTIVE' THEN false ELSE true END AS "is_active",
          COALESCE(s."createdAt", now()) AS "created_at",
          COALESCE(s."updatedAt", s."createdAt", now()) AS "updated_at"
        FROM ${legacySymbolsTableRef} s
        JOIN "exchange" e
          ON e."code" = CASE
            WHEN UPPER(COALESCE(s."exchange", '')) IN ('HSX', 'HOSE') THEN 'HOSE'
            WHEN UPPER(COALESCE(s."exchange", '')) = 'HNX' THEN 'HNX'
            WHEN UPPER(COALESCE(s."exchange", '')) IN ('UPCOM', 'UPCO') THEN 'UPCOM'
            ELSE 'UPCOM'
          END
        WHERE s."symbol" IS NOT NULL
        ON CONFLICT ("ticker") DO UPDATE
        SET
          "exchange_id" = COALESCE("symbol"."exchange_id", EXCLUDED."exchange_id"),
          "company_name" = COALESCE("symbol"."company_name", EXCLUDED."company_name"),
          "industry" = COALESCE("symbol"."industry", EXCLUDED."industry"),
          "updated_at" = GREATEST("symbol"."updated_at", EXCLUDED."updated_at");
      `);

      await queryRunner.query(`
        INSERT INTO "legacy_symbol_id_map" ("legacy_symbol_id", "symbol_id")
        SELECT
          s."id" AS "legacy_symbol_id",
          c."id" AS "symbol_id"
        FROM ${legacySymbolsTableRef} s
        JOIN "symbol" c ON UPPER(c."ticker") = UPPER(s."symbol")
        ON CONFLICT ("legacy_symbol_id") DO UPDATE
        SET
          "symbol_id" = EXCLUDED."symbol_id",
          "mapped_at" = now();
      `);
    }

    const legacyQuoteIntradayTable = await this.resolveLegacyTableName(
      queryRunner,
      'quote_intraday',
    );
    if (legacyQuoteIntradayTable) {
      const tableRef = this.quoteIdentifier(legacyQuoteIntradayTable);
      await this.auditFallbackSources(
        queryRunner,
        tableRef,
        'quote_intraday',
        'source',
        'SIMPLIZE_API',
      );
      await queryRunner.query(`
        INSERT INTO "stock_candle" (
          "symbol_id",
          "interval",
          "ts",
          "open",
          "high",
          "low",
          "close",
          "volume",
          "source_id",
          "created_at"
        )
        SELECT
          m."symbol_id",
          '15m',
          qi."ts",
          qi."price"::numeric(18,4),
          qi."price"::numeric(18,4),
          qi."price"::numeric(18,4),
          qi."price"::numeric(18,4),
          COALESCE(
            NULLIF(regexp_replace(COALESCE(qi."volume", '0'), '[^0-9-]', '', 'g'), ''),
            '0'
          )::bigint,
          ds."id",
          COALESCE(qi."ingestedAt", now())
        FROM ${tableRef} qi
        JOIN "legacy_symbol_id_map" m ON m."legacy_symbol_id" = qi."symbolId"
        JOIN "data_source" ds
          ON ds."code" = "__cutover_map_source_code"(COALESCE(qi."source", ''), 'SIMPLIZE_API')
        ON CONFLICT ("symbol_id", "interval", "ts") DO NOTHING;
      `);
    }

    const legacyQuoteDailyTable = await this.resolveLegacyTableName(queryRunner, 'quote_daily');
    if (legacyQuoteDailyTable) {
      const tableRef = this.quoteIdentifier(legacyQuoteDailyTable);
      await this.auditFallbackSources(
        queryRunner,
        tableRef,
        'quote_daily',
        'source',
        'SIMPLIZE_API',
      );
      await queryRunner.query(`
        INSERT INTO "stock_candle" (
          "symbol_id",
          "interval",
          "ts",
          "open",
          "high",
          "low",
          "close",
          "volume",
          "value",
          "put_through_volume",
          "put_through_value",
          "foreign_buy_volume",
          "foreign_sell_volume",
          "foreign_net_volume",
          "total_trades",
          "source_id",
          "created_at"
        )
        SELECT
          m."symbol_id",
          '1d',
          (qd."date"::timestamp AT TIME ZONE 'UTC'),
          qd."open"::numeric(18,4),
          qd."high"::numeric(18,4),
          qd."low"::numeric(18,4),
          qd."close"::numeric(18,4),
          COALESCE(
            NULLIF(regexp_replace(COALESCE(qd."volume", '0'), '[^0-9-]', '', 'g'), ''),
            '0'
          )::bigint,
          qd."value",
          qd."putThroughVolume",
          qd."putThroughValue",
          qd."foreignBuyVolume",
          qd."foreignSellVolume",
          qd."foreignNetVolume",
          qd."totalTrades",
          ds."id",
          COALESCE(qd."ingestedAt", now())
        FROM ${tableRef} qd
        JOIN "legacy_symbol_id_map" m ON m."legacy_symbol_id" = qd."symbolId"
        JOIN "data_source" ds
          ON ds."code" = "__cutover_map_source_code"(COALESCE(qd."source", ''), 'SIMPLIZE_API')
        ON CONFLICT ("symbol_id", "interval", "ts") DO NOTHING;
      `);
    }

    const legacyForeignTradingTable = await this.resolveLegacyTableName(
      queryRunner,
      'foreign_trading_daily',
    );
    if (legacyForeignTradingTable) {
      const tableRef = this.quoteIdentifier(legacyForeignTradingTable);
      await this.auditFallbackSources(
        queryRunner,
        tableRef,
        'foreign_trading_daily',
        'source',
        'SIMPLIZE_API',
      );
      await queryRunner.query(`
        INSERT INTO "stock_foreign_trading_daily" (
          "symbol_id",
          "trade_date",
          "buy_volume",
          "sell_volume",
          "net_volume",
          "buy_value",
          "sell_value",
          "net_value",
          "source_id",
          "created_at"
        )
        SELECT
          m."symbol_id",
          ftd."date",
          ftd."buyVolume",
          ftd."sellVolume",
          ftd."netVolume",
          ftd."buyValue",
          ftd."sellValue",
          ftd."netValue",
          ds."id",
          COALESCE(ftd."ingestedAt", now())
        FROM ${tableRef} ftd
        JOIN "legacy_symbol_id_map" m ON m."legacy_symbol_id" = ftd."symbolId"
        JOIN "data_source" ds
          ON ds."code" = "__cutover_map_source_code"(COALESCE(ftd."source", ''), 'SIMPLIZE_API')
        ON CONFLICT ("symbol_id", "trade_date", "source_id") DO NOTHING;
      `);
    }

    const legacyInsiderTable = await this.resolveLegacyTableName(
      queryRunner,
      'insider_trading_events',
    );
    if (legacyInsiderTable) {
      const tableRef = this.quoteIdentifier(legacyInsiderTable);
      await this.auditFallbackSources(
        queryRunner,
        tableRef,
        'insider_trading_events',
        'source',
        'SIMPLIZE_API',
      );
      await queryRunner.query(`
        INSERT INTO "stock_insider_event" (
          "symbol_id",
          "announce_date",
          "transaction_date",
          "insider_name",
          "insider_role",
          "action_type",
          "deal_method",
          "quantity_executed",
          "avg_price",
          "ownership_after",
          "source_id",
          "created_at"
        )
        SELECT
          m."symbol_id",
          ite."announceDate",
          ite."transactionDate",
          ite."insiderName",
          ite."insiderRole",
          COALESCE(ite."actionType", ite."transactionType"),
          ite."dealMethod",
          ite."quantity",
          ite."price"::numeric(18,4),
          ite."ownershipRatio",
          ds."id",
          COALESCE(ite."ingestedAt", now())
        FROM ${tableRef} ite
        JOIN "legacy_symbol_id_map" m ON m."legacy_symbol_id" = ite."symbolId"
        JOIN "data_source" ds
          ON ds."code" = "__cutover_map_source_code"(COALESCE(ite."source", ''), 'SIMPLIZE_API')
        ON CONFLICT (
          "symbol_id",
          "transaction_date",
          "insider_name",
          "action_type",
          "quantity_executed",
          "source_id"
        ) DO NOTHING;
      `);
    }

    const legacyPeersTable = await this.resolveLegacyTableName(
      queryRunner,
      'stock_related_peers',
    );
    if (legacyPeersTable) {
      const tableRef = this.quoteIdentifier(legacyPeersTable);
      await this.auditFallbackSources(
        queryRunner,
        tableRef,
        'stock_related_peers',
        'source',
        'SIMPLIZE_API',
      );
      await queryRunner.query(`
        INSERT INTO "stock_related_peer" (
          "symbol_id",
          "peer_ticker",
          "relation_type",
          "score",
          "source_id",
          "created_at"
        )
        SELECT
          m."symbol_id",
          srp."peerTicker",
          srp."relationType",
          srp."score",
          ds."id",
          COALESCE(srp."ingestedAt", now())
        FROM ${tableRef} srp
        JOIN "legacy_symbol_id_map" m ON m."legacy_symbol_id" = srp."symbolId"
        JOIN "data_source" ds
          ON ds."code" = "__cutover_map_source_code"(COALESCE(srp."source", ''), 'SIMPLIZE_API')
        ON CONFLICT ("symbol_id", "peer_ticker", "source_id") DO NOTHING;
      `);
    }

    const legacySubsidiariesTable = await this.resolveLegacyTableName(
      queryRunner,
      'company_subsidiaries',
    );
    if (legacySubsidiariesTable) {
      const tableRef = this.quoteIdentifier(legacySubsidiariesTable);
      await this.auditFallbackSources(
        queryRunner,
        tableRef,
        'company_subsidiaries',
        'source',
        'SIMPLIZE_API',
      );
      await queryRunner.query(`
        INSERT INTO "company_subsidiary" (
          "parent_symbol_id",
          "subsidiary_name",
          "ownership_percent",
          "relationship_type",
          "source_id",
          "created_at"
        )
        SELECT
          m."symbol_id",
          cs."subsidiaryName",
          cs."ownershipPercent",
          cs."relationshipType",
          ds."id",
          COALESCE(cs."ingestedAt", now())
        FROM ${tableRef} cs
        JOIN "legacy_symbol_id_map" m ON m."legacy_symbol_id" = cs."parentSymbolId"
        JOIN "data_source" ds
          ON ds."code" = "__cutover_map_source_code"(COALESCE(cs."source", ''), 'SIMPLIZE_API')
        ON CONFLICT ("parent_symbol_id", "subsidiary_name", "source_id") DO NOTHING;
      `);
    }

    const legacyReportsTable = await this.resolveLegacyTableName(
      queryRunner,
      'company_reports',
    );
    if (legacyReportsTable) {
      const tableRef = this.quoteIdentifier(legacyReportsTable);
      await this.auditFallbackSources(
        queryRunner,
        tableRef,
        'company_reports',
        'source',
        'SIMPLIZE_API',
      );
      await queryRunner.query(`
        INSERT INTO "company_report" (
          "symbol_id",
          "report_type",
          "title",
          "published_at",
          "file_url",
          "file_url_hash",
          "source_id",
          "created_at"
        )
        SELECT
          m."symbol_id",
          cr."reportType",
          cr."title",
          cr."publishedAt",
          cr."fileUrl",
          cr."fileUrlHash",
          ds."id",
          COALESCE(cr."ingestedAt", now())
        FROM ${tableRef} cr
        JOIN "legacy_symbol_id_map" m ON m."legacy_symbol_id" = cr."symbolId"
        JOIN "data_source" ds
          ON ds."code" = "__cutover_map_source_code"(COALESCE(cr."source", ''), 'SIMPLIZE_API')
        ON CONFLICT ("symbol_id", "file_url_hash", "source_id") DO NOTHING;
      `);
    }

    const legacyNewsTable = await this.resolveLegacyTableName(queryRunner, 'news_articles');
    if (legacyNewsTable) {
      const tableRef = this.quoteIdentifier(legacyNewsTable);
      await this.auditFallbackSources(
        queryRunner,
        tableRef,
        'news_articles',
        'source',
        'CAFEF_HTML',
      );
      await queryRunner.query(`
        INSERT INTO "news_article" (
          "source_id",
          "url",
          "url_hash",
          "published_at",
          "title",
          "summary",
          "subtitle",
          "content",
          "tickers",
          "tags",
          "fetched_at",
          "provider_news_id",
          "lang_code",
          "source_link",
          "news_image_url",
          "source_created_at",
          "source_updated_at",
          "created_at"
        )
        SELECT
          ds."id",
          na."url",
          na."urlHash",
          na."publishedAt",
          na."title",
          na."summary",
          na."subtitle",
          na."content",
          na."tickers",
          na."tags",
          COALESCE(na."fetchedAt", na."ingestedAt", now()),
          na."providerNewsId",
          na."languageCode",
          na."sourceLink",
          na."imageUrl",
          na."sourceCreatedAt",
          na."sourceUpdatedAt",
          COALESCE(na."ingestedAt", now())
        FROM ${tableRef} na
        JOIN "data_source" ds
          ON ds."code" = "__cutover_map_source_code"(COALESCE(na."source", ''), 'CAFEF_HTML')
        ON CONFLICT ("source_id", "url_hash") DO NOTHING;
      `);
    }

    const legacyCrawlRunsTable = await this.resolveLegacyTableName(queryRunner, 'crawl_runs');
    if (legacyCrawlRunsTable) {
      const tableRef = this.quoteIdentifier(legacyCrawlRunsTable);
      await queryRunner.query(`
        INSERT INTO "job_run" (
          "id",
          "job_name",
          "scheduled_for",
          "started_at",
          "finished_at",
          "status",
          "items",
          "error"
        )
        SELECT
          cr."id",
          cr."jobName",
          NULL,
          COALESCE(cr."startedAt", now()),
          cr."endedAt",
          CASE
            WHEN cr."status" = 'SUCCESS' THEN 'SUCCESS'
            WHEN cr."status" = 'FAILED' THEN 'FAIL'
            ELSE 'SKIP'
          END::"job_status_enum",
          CASE
            WHEN (cr."statsJson" ->> 'rowsUpserted') ~ '^[0-9]+$'
              THEN (cr."statsJson" ->> 'rowsUpserted')::integer
            ELSE 0
          END,
          cr."errorText"
        FROM ${tableRef} cr
        ON CONFLICT ("id") DO NOTHING;
      `);
    }

    const legacyRelationNames = [
      'symbols',
      'quote_daily',
      'quote_intraday',
      'foreign_trading_daily',
      'insider_trading_events',
      'stock_related_peers',
      'company_subsidiaries',
      'company_reports',
      'news_articles',
      'crawl_runs',
    ];

    for (const relationName of legacyRelationNames) {
      await this.dropRelationIfExists(queryRunner, relationName);
      await this.dropRelationIfExists(queryRunner, `${relationName}_legacy`);
    }

    await queryRunner.query(`DROP FUNCTION IF EXISTS "legacy_deterministic_uuid"(text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "legacy_source_from_code"(text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "__cutover_map_source_code"(text, text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "__cutover_source_uses_fallback"(text)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cutover_source_fallback_audit"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "legacy_symbol_id_map"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "__cutover_map_source_code"(text, text)`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "__cutover_source_uses_fallback"(text)`);
  }

  private async auditFallbackSources(
    queryRunner: QueryRunner,
    tableRef: string,
    tableName: string,
    sourceColumn: string,
    fallbackCode: string,
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "cutover_source_fallback_audit" (
        "table_name",
        "legacy_source",
        "fallback_code",
        "note"
      )
      SELECT DISTINCT
        '${tableName}',
        t."${sourceColumn}"::text,
        '${fallbackCode}',
        'source matched fallback mapping during datahub cutover'
      FROM ${tableRef} t
      WHERE "__cutover_source_uses_fallback"(t."${sourceColumn}"::text)
        AND COALESCE(t."${sourceColumn}"::text, '') <> ''
      ON CONFLICT ("table_name", "legacy_source", "fallback_code") DO NOTHING;
    `);
  }

  private async resolveLegacyTableName(
    queryRunner: QueryRunner,
    baseName: string,
  ): Promise<string | null> {
    const baseKind = await this.getRelationKind(queryRunner, baseName);
    if (baseKind === 'r' || baseKind === 'p') {
      return baseName;
    }

    const legacyName = `${baseName}_legacy`;
    const legacyKind = await this.getRelationKind(queryRunner, legacyName);
    if (legacyKind === 'r' || legacyKind === 'p') {
      return legacyName;
    }

    return null;
  }

  private async dropRelationIfExists(
    queryRunner: QueryRunner,
    relationName: string,
  ): Promise<void> {
    const relKind = await this.getRelationKind(queryRunner, relationName);
    if (relKind === 'r' || relKind === 'p') {
      await queryRunner.query(`DROP TABLE ${this.quoteIdentifier(relationName)} CASCADE`);
      return;
    }

    if (relKind === 'v') {
      await queryRunner.query(`DROP VIEW ${this.quoteIdentifier(relationName)} CASCADE`);
      return;
    }

    if (relKind === 'm') {
      await queryRunner.query(
        `DROP MATERIALIZED VIEW ${this.quoteIdentifier(relationName)} CASCADE`,
      );
    }
  }

  private async getRelationKind(
    queryRunner: QueryRunner,
    relationName: string,
  ): Promise<string | null> {
    const rows = (await queryRunner.query(
      `
        SELECT c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relname = $1
        LIMIT 1
      `,
      [relationName],
    )) as RelKindRow[];

    return rows[0]?.relkind ?? null;
  }

  private quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }
}
