import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class LegacyCompatViewService implements OnModuleInit {
  private readonly logger = new Logger(LegacyCompatViewService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    const mode = (this.configService.get<string>('unified.mode') || 'legacy').toLowerCase();
    const compatEnabled =
      this.configService.get<boolean>('unified.legacyCompatViewsEnabled') === true;

    if (mode !== 'datahub' || !compatEnabled) {
      return;
    }

    this.logger.log(
      'Applying legacy compatibility view cutover (rename legacy tables to *_legacy and create readonly views)',
    );
    await this.applyCompatibilityViews();
  }

  private async applyCompatibilityViews(): Promise<void> {
    const legacyTableNames = [
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

    for (const tableName of legacyTableNames) {
      await this.renameLegacyTableToSuffix(tableName);
    }

    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION legacy_deterministic_uuid(input_text text)
      RETURNS uuid
      LANGUAGE SQL
      IMMUTABLE
      STRICT
      AS $$
        SELECT (
          substr(md5(input_text), 1, 8) || '-' ||
          substr(md5(input_text), 9, 4) || '-' ||
          '4' || substr(md5(input_text), 14, 3) || '-' ||
          'a' || substr(md5(input_text), 18, 3) || '-' ||
          substr(md5(input_text), 21, 12)
        )::uuid
      $$;
    `);

    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION legacy_source_from_code(code text)
      RETURNS text
      LANGUAGE SQL
      IMMUTABLE
      STRICT
      AS $$
        SELECT CASE UPPER(code)
          WHEN 'SIMPLIZE_API' THEN 'SIMPLIZE'
          WHEN 'TCBS_API' THEN 'TCBS'
          WHEN 'SSI_API' THEN 'SSI'
          WHEN 'VNDIRECT_HTML' THEN 'VNDIRECT'
          WHEN 'CAFEF_HTML' THEN 'CAFEF'
          WHEN 'SJC_HTML' THEN 'SJC'
          WHEN 'VNAPPMOB_GOLD' THEN 'VNAPPMOB'
          ELSE code
        END
      $$;
    `);

    await this.createOrReplaceViews();
    this.logger.log('Legacy compatibility views applied successfully');
  }

  private async renameLegacyTableToSuffix(tableName: string): Promise<void> {
    const hasTable = await this.objectExists(tableName, 'r');
    if (!hasTable) {
      return;
    }

    const legacyName = `${tableName}_legacy`;
    const legacyExists = await this.objectExists(legacyName, 'r');
    if (legacyExists) {
      this.logger.warn(
        `Skip rename ${tableName} -> ${legacyName} because ${legacyName} already exists`,
      );
      return;
    }

    await this.dataSource.query(`ALTER TABLE "${tableName}" RENAME TO "${legacyName}"`);
    this.logger.log(`Renamed table "${tableName}" to "${legacyName}"`);
  }

  private async objectExists(name: string, kind: 'r' | 'v' | 'm'): Promise<boolean> {
    const rows = await this.dataSource.query(
      `
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema()
          AND c.relname = $1
          AND c.relkind = $2
        LIMIT 1
      `,
      [name, kind],
    );

    return rows.length > 0;
  }

  private async createOrReplaceViews(): Promise<void> {
    const viewStatements = [
      `
        CREATE OR REPLACE VIEW "symbols" AS
        SELECT
          legacy_deterministic_uuid('symbol:' || UPPER(s."ticker")) AS "id",
          s."ticker" AS "symbol",
          e."code" AS "exchange",
          s."company_name" AS "name",
          s."industry" AS "industryCode",
          CASE WHEN s."is_active" THEN 'ACTIVE' ELSE 'INACTIVE' END AS "status",
          s."created_at" AS "createdAt",
          s."updated_at" AS "updatedAt"
        FROM "symbol" s
        LEFT JOIN "exchange" e ON e."id" = s."exchange_id"
      `,
      `
        CREATE OR REPLACE VIEW "quote_daily" AS
        SELECT
          legacy_deterministic_uuid(
            'quote_daily:' || UPPER(s."ticker") || ':' || (sc."ts"::date)::text || ':' || ds."code"
          ) AS "id",
          legacy_deterministic_uuid('symbol:' || UPPER(s."ticker")) AS "symbolId",
          sc."ts"::date AS "date",
          sc."open"::double precision AS "open",
          sc."high"::double precision AS "high",
          sc."low"::double precision AS "low",
          sc."close"::double precision AS "close",
          sc."volume"::text AS "volume",
          sc."value" AS "value",
          sc."put_through_volume" AS "putThroughVolume",
          sc."put_through_value" AS "putThroughValue",
          sc."foreign_buy_volume" AS "foreignBuyVolume",
          sc."foreign_sell_volume" AS "foreignSellVolume",
          sc."foreign_net_volume" AS "foreignNetVolume",
          sc."total_trades" AS "totalTrades",
          legacy_source_from_code(ds."code") AS "source",
          sc."created_at" AS "ingestedAt"
        FROM "stock_candle" sc
        JOIN "symbol" s ON s."id" = sc."symbol_id"
        JOIN "data_source" ds ON ds."id" = sc."source_id"
        WHERE sc."interval" = '1d'
      `,
      `
        CREATE OR REPLACE VIEW "quote_intraday" AS
        SELECT
          legacy_deterministic_uuid(
            'quote_intraday:' || UPPER(s."ticker") || ':' || sc."ts"::text || ':' || ds."code"
          ) AS "id",
          legacy_deterministic_uuid('symbol:' || UPPER(s."ticker")) AS "symbolId",
          sc."ts" AS "ts",
          sc."close"::double precision AS "price",
          sc."volume"::text AS "volume",
          NULL::varchar(20) AS "matchType",
          NULL::varchar(64) AS "tradeId",
          NULL::double precision AS "priceChange",
          NULL::bigint AS "accumulatedVolume",
          NULL::numeric(22,4) AS "accumulatedValue",
          legacy_source_from_code(ds."code") AS "source",
          sc."created_at" AS "ingestedAt"
        FROM "stock_candle" sc
        JOIN "symbol" s ON s."id" = sc."symbol_id"
        JOIN "data_source" ds ON ds."id" = sc."source_id"
        WHERE sc."interval" = '15m'
      `,
      `
        CREATE OR REPLACE VIEW "foreign_trading_daily" AS
        SELECT
          legacy_deterministic_uuid(
            'foreign_trading_daily:' || UPPER(s."ticker") || ':' || f."trade_date"::text || ':' || ds."code"
          ) AS "id",
          legacy_deterministic_uuid('symbol:' || UPPER(s."ticker")) AS "symbolId",
          f."trade_date" AS "date",
          f."buy_volume" AS "buyVolume",
          f."sell_volume" AS "sellVolume",
          f."net_volume" AS "netVolume",
          f."buy_value" AS "buyValue",
          f."sell_value" AS "sellValue",
          f."net_value" AS "netValue",
          legacy_source_from_code(ds."code") AS "source",
          f."created_at" AS "ingestedAt"
        FROM "stock_foreign_trading_daily" f
        JOIN "symbol" s ON s."id" = f."symbol_id"
        JOIN "data_source" ds ON ds."id" = f."source_id"
      `,
      `
        CREATE OR REPLACE VIEW "insider_trading_events" AS
        SELECT
          legacy_deterministic_uuid(
            'insider_trading_events:' || UPPER(s."ticker") || ':' || i."transaction_date"::text || ':' || COALESCE(i."insider_name",'') || ':' || ds."code"
          ) AS "id",
          legacy_deterministic_uuid('symbol:' || UPPER(s."ticker")) AS "symbolId",
          i."transaction_date" AS "transactionDate",
          i."announce_date" AS "announceDate",
          i."insider_name" AS "insiderName",
          i."insider_role" AS "insiderRole",
          i."action_type" AS "transactionType",
          i."deal_method" AS "dealMethod",
          i."action_type" AS "actionType",
          i."quantity_executed" AS "quantity",
          i."avg_price"::double precision AS "price",
          i."ownership_after" AS "ownershipRatio",
          legacy_source_from_code(ds."code") AS "source",
          i."created_at" AS "ingestedAt"
        FROM "stock_insider_event" i
        JOIN "symbol" s ON s."id" = i."symbol_id"
        JOIN "data_source" ds ON ds."id" = i."source_id"
      `,
      `
        CREATE OR REPLACE VIEW "stock_related_peers" AS
        SELECT
          legacy_deterministic_uuid(
            'stock_related_peers:' || UPPER(s."ticker") || ':' || UPPER(r."peer_ticker") || ':' || ds."code"
          ) AS "id",
          legacy_deterministic_uuid('symbol:' || UPPER(s."ticker")) AS "symbolId",
          r."peer_ticker" AS "peerTicker",
          r."relation_type" AS "relationType",
          r."score" AS "score",
          legacy_source_from_code(ds."code") AS "source",
          r."created_at" AS "ingestedAt"
        FROM "stock_related_peer" r
        JOIN "symbol" s ON s."id" = r."symbol_id"
        JOIN "data_source" ds ON ds."id" = r."source_id"
      `,
      `
        CREATE OR REPLACE VIEW "company_subsidiaries" AS
        SELECT
          legacy_deterministic_uuid(
            'company_subsidiaries:' || UPPER(s."ticker") || ':' || c."subsidiary_name" || ':' || ds."code"
          ) AS "id",
          legacy_deterministic_uuid('symbol:' || UPPER(s."ticker")) AS "parentSymbolId",
          c."subsidiary_name" AS "subsidiaryName",
          c."ownership_percent" AS "ownershipPercent",
          c."relationship_type" AS "relationshipType",
          legacy_source_from_code(ds."code") AS "source",
          c."created_at" AS "ingestedAt"
        FROM "company_subsidiary" c
        JOIN "symbol" s ON s."id" = c."parent_symbol_id"
        JOIN "data_source" ds ON ds."id" = c."source_id"
      `,
      `
        CREATE OR REPLACE VIEW "company_reports" AS
        SELECT
          legacy_deterministic_uuid(
            'company_reports:' || UPPER(s."ticker") || ':' || c."file_url_hash" || ':' || ds."code"
          ) AS "id",
          legacy_deterministic_uuid('symbol:' || UPPER(s."ticker")) AS "symbolId",
          c."report_type" AS "reportType",
          c."title" AS "title",
          c."published_at" AS "publishedAt",
          c."file_url" AS "fileUrl",
          c."file_url_hash" AS "fileUrlHash",
          legacy_source_from_code(ds."code") AS "source",
          c."created_at" AS "ingestedAt"
        FROM "company_report" c
        JOIN "symbol" s ON s."id" = c."symbol_id"
        JOIN "data_source" ds ON ds."id" = c."source_id"
      `,
      `
        CREATE OR REPLACE VIEW "news_articles" AS
        SELECT
          legacy_deterministic_uuid(
            'news_articles:' || n."url_hash" || ':' || ds."code"
          ) AS "id",
          n."url" AS "url",
          n."url_hash" AS "urlHash",
          n."published_at" AS "publishedAt",
          n."title" AS "title",
          n."summary" AS "summary",
          n."subtitle" AS "subtitle",
          n."content" AS "content",
          n."tickers" AS "tickers",
          n."tags" AS "tags",
          legacy_source_from_code(ds."code") AS "source",
          n."provider_news_id" AS "providerNewsId",
          n."lang_code" AS "languageCode",
          n."source_link" AS "sourceLink",
          n."news_image_url" AS "imageUrl",
          n."source_created_at" AS "sourceCreatedAt",
          n."source_updated_at" AS "sourceUpdatedAt",
          n."fetched_at" AS "fetchedAt",
          n."created_at" AS "ingestedAt"
        FROM "news_article" n
        JOIN "data_source" ds ON ds."id" = n."source_id"
      `,
      `
        CREATE OR REPLACE VIEW "crawl_runs" AS
        SELECT
          j."id" AS "id",
          j."job_name" AS "jobName",
          'DATA_HUB'::varchar(50) AS "source",
          j."started_at" AS "startedAt",
          j."finished_at" AS "endedAt",
          CASE
            WHEN j."status" = 'SUCCESS' THEN 'SUCCESS'
            WHEN j."status" = 'FAIL' THEN 'FAILED'
            ELSE 'FAILED'
          END::varchar(20) AS "status",
          j."error" AS "errorText",
          jsonb_build_object(
            'jobName', j."job_name",
            'status', j."status",
            'items', j."items"
          ) AS "statsJson"
        FROM "job_run" j
      `,
    ];

    for (const statement of viewStatements) {
      await this.dataSource.query(statement);
    }
  }
}
