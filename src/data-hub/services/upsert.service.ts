import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { createHash } from 'crypto';

export interface UpsertResult {
  inserted: number;
  updated: number;
  skipped: number;
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
      sourceId: number;
    }>
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'stock_candle',
      candles,
      ['symbol_id', 'interval', 'ts'],
      ['open', 'high', 'low', 'close', 'volume', 'value'],
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
      eps?: string;
      marketCap?: string;
      freeFloat?: string;
      sharesOut?: string;
      sourceId: number;
    }>
  ): Promise<UpsertResult> {
    return this.batchUpsert(
      'stock_snapshot',
      snapshots,
      ['symbol_id', 'as_of'],
      ['pe', 'eps', 'market_cap', 'free_float', 'shares_out'],
      (s) => ({
        symbol_id: s.symbolId,
        as_of: s.asOf,
        pe: s.pe,
        eps: s.eps,
        market_cap: s.marketCap,
        free_float: s.freeFloat,
        shares_out: s.sharesOut,
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
      content?: string;
      tickers?: string[];
      tags?: string[];
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
      ['published_at', 'title', 'summary', 'content', 'tickers', 'tags', 'fetched_at'],
      (a) => ({
        source_id: a.sourceId,
        url: a.url,
        url_hash: a.urlHash,
        published_at: a.publishedAt,
        title: a.title,
        summary: a.summary,
        content: a.content,
        tickers: a.tickers ? `{${a.tickers.join(',')}}` : null,
        tags: a.tags ? `{${a.tags.join(',')}}` : null,
        fetched_at: a.fetchedAt,
      })
    );
  }

  private async batchUpsert<T>(
    tableName: string,
    items: T[],
    conflictColumns: string[],
    updateColumns: string[],
    mapper: (item: T) => Record<string, any>
  ): Promise<UpsertResult> {
    const result: UpsertResult = { inserted: 0, updated: 0, skipped: 0 };

    if (items.length === 0) {
      return result;
    }

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
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Batch upsert failed for ${tableName}: ${error.message}`);
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
    `;

    await queryRunner.query(sql, values);

    return { inserted: items.length, updated: 0, skipped: 0 };
  }
}
