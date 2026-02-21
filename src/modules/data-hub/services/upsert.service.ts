import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { createHash } from 'crypto';
import { logPayload, toLogError } from '../../../common/logging/ingestion-log';

export interface UpsertResult {
  inserted: number;
  updated: number;
  skipped: number;
  processed: number;
}

@Injectable()
export class UpsertService {
  private readonly logger = new Logger(UpsertService.name);
  private readonly batchSize = 500;

  constructor(private readonly dataSource: DataSource) {}

  async upsertStockCandles(
    candles: Array<{
      symbolId: number;
      interval: string;
      ts: Date;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
      value?: string;
      foreignBuyVolume?: string;
      foreignSellVolume?: string;
      foreignNetVolume?: string;
      putThroughVolume?: string;
      putThroughValue?: string;
      totalTrades?: string;
      sourceId: number;
    }>
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'stock_candle',
      candles,
      ['symbol_id', 'interval', 'ts'],
      [
        'open',
        'high',
        'low',
        'close',
        'volume',
        'value',
        'foreign_buy_volume',
        'foreign_sell_volume',
        'foreign_net_volume',
        'put_through_volume',
        'put_through_value',
        'total_trades',
      ],
      (c) => ({
        symbol_id: c.symbolId,
        interval: c.interval,
        ts: c.ts,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        value: c.value,
        foreign_buy_volume: c.foreignBuyVolume,
        foreign_sell_volume: c.foreignSellVolume,
        foreign_net_volume: c.foreignNetVolume,
        put_through_volume: c.putThroughVolume,
        put_through_value: c.putThroughValue,
        total_trades: c.totalTrades,
        source_id: c.sourceId,
      })
    );
  }

  async upsertIndexCandles(
    candles: Array<{
      indexId: number;
      interval: string;
      ts: Date;
      open: string;
      high: string;
      low: string;
      close: string;
      volume?: string;
      sourceId: number;
    }>
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'index_candle',
      candles,
      ['index_id', 'interval', 'ts'],
      ['open', 'high', 'low', 'close', 'volume'],
      (c) => ({
        index_id: c.indexId,
        interval: c.interval,
        ts: c.ts,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        source_id: c.sourceId,
      })
    );
  }

  async upsertSnapshots(
    snapshots: Array<{
      symbolId: number;
      asOf: Date;
      pe?: string;
      pb?: string;
      ps?: string;
      roe?: string;
      roa?: string;
      ev?: string;
      eps?: string;
      marketCap?: string;
      freeFloat?: string;
      sharesOut?: string;
      foreignRoom?: string;
      foreignHoldingRoom?: string;
      currentHoldingRatio?: string;
      maxHoldingRatio?: string;
      avgMatchVolume2w?: string;
      sourceId: number;
    }>
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'stock_snapshot',
      snapshots,
      ['symbol_id', 'as_of'],
      [
        'pe',
        'pb',
        'ps',
        'roe',
        'roa',
        'ev',
        'eps',
        'market_cap',
        'free_float',
        'shares_out',
        'foreign_room',
        'foreign_holding_room',
        'current_holding_ratio',
        'max_holding_ratio',
        'avg_match_volume_2w',
      ],
      (s) => ({
        symbol_id: s.symbolId,
        as_of: s.asOf,
        pe: s.pe,
        pb: s.pb,
        ps: s.ps,
        roe: s.roe,
        roa: s.roa,
        ev: s.ev,
        eps: s.eps,
        market_cap: s.marketCap,
        free_float: s.freeFloat,
        shares_out: s.sharesOut,
        foreign_room: s.foreignRoom,
        foreign_holding_room: s.foreignHoldingRoom,
        current_holding_ratio: s.currentHoldingRatio,
        max_holding_ratio: s.maxHoldingRatio,
        avg_match_volume_2w: s.avgMatchVolume2w,
        source_id: s.sourceId,
      })
    );
  }

  async upsertGoldPrices(
    prices: Array<{
      provider: string;
      asOf: Date;
      buy: string;
      sell: string;
      raw?: Record<string, any>;
      sourceId: number;
    }>
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'gold_price',
      prices,
      ['provider', 'as_of'],
      ['buy', 'sell', 'raw'],
      (p) => ({
        provider: p.provider,
        as_of: p.asOf,
        buy: p.buy,
        sell: p.sell,
        raw: p.raw ? JSON.stringify(p.raw) : null,
        source_id: p.sourceId,
      })
    );
  }

  computeUrlHash(url: string): string {
    const normalized = url.trim().toLowerCase();
    return createHash('sha256').update(normalized).digest('hex');
  }

  async upsertNewsArticles(
    articles: Array<{
      sourceId: number;
      url: string;
      publishedAt?: Date;
      title: string;
      summary?: string;
      subtitle?: string;
      content?: string;
      tickers?: string[];
      tags?: string[];
      providerNewsId?: string;
      langCode?: string;
      sourceLink?: string;
      newsImageUrl?: string;
      sourceCreatedAt?: Date;
      sourceUpdatedAt?: Date;
      fetchedAt: Date;
    }>
  ): Promise<UpsertResult> {
    const withHash = articles.map((a) => ({
      ...a,
      urlHash: this.computeUrlHash(a.url),
    }));

    return this.batchUpsert(
      'news_article',
      withHash,
      ['source_id', 'url_hash'],
      [
        'published_at',
        'title',
        'summary',
        'subtitle',
        'content',
        'tickers',
        'tags',
        'provider_news_id',
        'lang_code',
        'source_link',
        'news_image_url',
        'source_created_at',
        'source_updated_at',
        'fetched_at',
      ],
      (a) => ({
        source_id: a.sourceId,
        url: a.url,
        url_hash: a.urlHash,
        published_at: a.publishedAt,
        title: a.title,
        summary: a.summary,
        subtitle: a.subtitle,
        content: a.content,
        tickers: a.tickers ? `{${a.tickers.join(',')}}` : null,
        tags: a.tags ? `{${a.tags.join(',')}}` : null,
        provider_news_id: a.providerNewsId,
        lang_code: a.langCode,
        source_link: a.sourceLink,
        news_image_url: a.newsImageUrl,
        source_created_at: a.sourceCreatedAt,
        source_updated_at: a.sourceUpdatedAt,
        fetched_at: a.fetchedAt,
      })
    );
  }

  async upsertStockForeignTradingDaily(
    rows: Array<{
      symbolId: number;
      tradeDate: Date;
      buyVolume?: string;
      sellVolume?: string;
      netVolume?: string;
      buyValue?: string;
      sellValue?: string;
      netValue?: string;
      foreignRoom?: string;
      foreignHoldingRoom?: string;
      currentHoldingRatio?: string;
      maxHoldingRatio?: string;
      rawPayload?: Record<string, unknown> | null;
      sourceId: number;
    }>,
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'stock_foreign_trading_daily',
      rows,
      ['symbol_id', 'trade_date', 'source_id'],
      [
        'buy_volume',
        'sell_volume',
        'net_volume',
        'buy_value',
        'sell_value',
        'net_value',
        'foreign_room',
        'foreign_holding_room',
        'current_holding_ratio',
        'max_holding_ratio',
        'raw_payload',
      ],
      (row) => ({
        symbol_id: row.symbolId,
        trade_date: row.tradeDate,
        buy_volume: row.buyVolume,
        sell_volume: row.sellVolume,
        net_volume: row.netVolume,
        buy_value: row.buyValue,
        sell_value: row.sellValue,
        net_value: row.netValue,
        foreign_room: row.foreignRoom,
        foreign_holding_room: row.foreignHoldingRoom,
        current_holding_ratio: row.currentHoldingRatio,
        max_holding_ratio: row.maxHoldingRatio,
        raw_payload: row.rawPayload ? JSON.stringify(row.rawPayload) : null,
        source_id: row.sourceId,
      }),
    );
  }

  async upsertStockInsiderEvents(
    rows: Array<{
      symbolId: number;
      announceDate?: Date;
      transactionDate: Date;
      insiderName?: string;
      insiderRole?: string;
      relatedPerson?: string;
      actionType?: string;
      dealMethod?: string;
      status?: string;
      quantityRegistered?: string;
      quantityExecuted?: string;
      quantityRemaining?: string;
      priceFrom?: string;
      priceTo?: string;
      avgPrice?: string;
      dealValue?: string;
      ownershipBefore?: string;
      ownershipAfter?: string;
      ownershipChange?: string;
      sourceEventId?: string;
      sourceUrl?: string;
      rawPayload?: Record<string, unknown> | null;
      sourceId: number;
    }>,
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'stock_insider_event',
      rows,
      [
        'symbol_id',
        'transaction_date',
        'insider_name',
        'action_type',
        'quantity_executed',
        'source_id',
      ],
      [
        'announce_date',
        'insider_role',
        'related_person',
        'deal_method',
        'status',
        'quantity_registered',
        'quantity_remaining',
        'price_from',
        'price_to',
        'avg_price',
        'deal_value',
        'ownership_before',
        'ownership_after',
        'ownership_change',
        'source_event_id',
        'source_url',
        'raw_payload',
      ],
      (row) => ({
        symbol_id: row.symbolId,
        announce_date: row.announceDate,
        transaction_date: row.transactionDate,
        insider_name: row.insiderName,
        insider_role: row.insiderRole,
        related_person: row.relatedPerson,
        action_type: row.actionType,
        deal_method: row.dealMethod,
        status: row.status,
        quantity_registered: row.quantityRegistered,
        quantity_executed: row.quantityExecuted,
        quantity_remaining: row.quantityRemaining,
        price_from: row.priceFrom,
        price_to: row.priceTo,
        avg_price: row.avgPrice,
        deal_value: row.dealValue,
        ownership_before: row.ownershipBefore,
        ownership_after: row.ownershipAfter,
        ownership_change: row.ownershipChange,
        source_event_id: row.sourceEventId,
        source_url: row.sourceUrl,
        raw_payload: row.rawPayload ? JSON.stringify(row.rawPayload) : null,
        source_id: row.sourceId,
      }),
    );
  }

  async upsertStockRelatedPeers(
    rows: Array<{
      symbolId: number;
      peerTicker: string;
      relationType?: string | null;
      score?: number | null;
      sourceId: number;
    }>,
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'stock_related_peer',
      rows,
      ['symbol_id', 'peer_ticker', 'source_id'],
      ['relation_type', 'score'],
      (row) => ({
        symbol_id: row.symbolId,
        peer_ticker: row.peerTicker,
        relation_type: row.relationType ?? null,
        score: row.score ?? null,
        source_id: row.sourceId,
      }),
    );
  }

  async upsertCompanySubsidiaries(
    rows: Array<{
      parentSymbolId: number;
      subsidiaryName: string;
      ownershipPercent?: number | null;
      relationshipType?: string | null;
      sourceId: number;
    }>,
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'company_subsidiary',
      rows,
      ['parent_symbol_id', 'subsidiary_name', 'source_id'],
      ['ownership_percent', 'relationship_type'],
      (row) => ({
        parent_symbol_id: row.parentSymbolId,
        subsidiary_name: row.subsidiaryName,
        ownership_percent: row.ownershipPercent ?? null,
        relationship_type: row.relationshipType ?? null,
        source_id: row.sourceId,
      }),
    );
  }

  async upsertCompanyReports(
    rows: Array<{
      symbolId: number;
      reportType: string;
      title?: string | null;
      publishedAt?: Date | null;
      fileUrl: string;
      fileUrlHash: string;
      sourceId: number;
    }>,
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'company_report',
      rows,
      ['symbol_id', 'file_url_hash', 'source_id'],
      ['report_type', 'title', 'published_at', 'file_url'],
      (row) => ({
        symbol_id: row.symbolId,
        report_type: row.reportType,
        title: row.title ?? null,
        published_at: row.publishedAt ?? null,
        file_url: row.fileUrl,
        file_url_hash: row.fileUrlHash,
        source_id: row.sourceId,
      }),
    );
  }

  private async batchUpsert<T>(
    tableName: string,
    items: T[],
    conflictColumns: string[],
    updateColumns: string[],
    mapper: (item: T) => Record<string, any>
  ): Promise<UpsertResult> {
    const result: UpsertResult = { inserted: 0, updated: 0, skipped: 0, processed: 0 };

    if (items.length === 0) {
      return result;
    }

    this.logger.log(
      logPayload({
        event: 'upsert_batch_started',
        module: 'data-hub.upsert',
        status: 'started',
        tableName,
        batchSize: this.batchSize,
        itemCount: items.length,
      }),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (let i = 0; i < items.length; i += this.batchSize) {
        const batch = items.slice(i, i + this.batchSize);
        const batchResult = await this.executeBatchUpsert(
          queryRunner,
          tableName,
          batch,
          conflictColumns,
          updateColumns,
          mapper
        );
        result.inserted += batchResult.inserted;
        result.updated += batchResult.updated;
        result.processed += batchResult.processed;
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        logPayload({
          event: 'upsert_batch_completed',
          module: 'data-hub.upsert',
          status: 'succeeded',
          tableName,
          processed: result.processed,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
        }),
      );
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        logPayload({
          event: 'upsert_batch_failed',
          module: 'data-hub.upsert',
          status: 'failed',
          tableName,
          conflictColumns,
          error: toLogError(error),
        }),
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    return result;
  }

  private async executeBatchUpsert<T>(
    queryRunner: QueryRunner,
    tableName: string,
    items: T[],
    conflictColumns: string[],
    updateColumns: string[],
    mapper: (item: T) => Record<string, any>
  ): Promise<UpsertResult> {
    const mappedItems = items.map(mapper);
    const columns = Object.keys(mappedItems[0]);

    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    mappedItems.forEach((item, rowIndex) => {
      const rowPlaceholders: string[] = [];
      columns.forEach((col, colIndex) => {
        values.push(item[col]);
        rowPlaceholders.push(`$${rowIndex * columns.length + colIndex + 1}`);
      });
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    });

    const updateClause = updateColumns
      .map((col) => `"${col}" = EXCLUDED."${col}"`)
      .join(', ');

    const sql = `
      INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (${conflictColumns.map((c) => `"${c}"`).join(', ')})
      DO UPDATE SET ${updateClause}
      RETURNING (xmax = 0) AS inserted
    `;

    const rows = (await queryRunner.query(sql, values)) as Array<{
      inserted: boolean | 't' | 'f' | 'true' | 'false';
    }>;
    const inserted = rows.reduce((count, row) => {
      const value = row.inserted;
      if (value === true || value === 't' || value === 'true') {
        return count + 1;
      }
      return count;
    }, 0);
    const updated = rows.length - inserted;

    return { inserted, updated, skipped: 0, processed: rows.length };
  }
}
