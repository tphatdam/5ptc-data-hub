import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UpsertService } from './upsert.service';
import { CandleInterval } from '../enums';

type BackfillTaskName =
  | 'symbols'
  | 'quote_intraday'
  | 'quote_daily'
  | 'foreign_trading_daily'
  | 'insider_trading_events'
  | 'stock_related_peers'
  | 'company_subsidiaries'
  | 'company_reports'
  | 'news_articles';

interface BackfillState {
  taskName: BackfillTaskName;
  cursor: string | null;
  status: string;
}

interface TaskBatchResult {
  rowCount: number;
  processed: number;
  nextCursor: string | null;
}

interface CanonicalSymbolUpsertRow {
  ticker: string;
  exchangeId: number;
  companyName: string | null;
  industry: string | null;
  isin: string | null;
  isActive: boolean;
  listedAt: Date | null;
}

const BACKFILL_TASK_ORDER: BackfillTaskName[] = [
  'symbols',
  'quote_intraday',
  'quote_daily',
  'foreign_trading_daily',
  'insider_trading_events',
  'stock_related_peers',
  'company_subsidiaries',
  'company_reports',
  'news_articles',
];

@Injectable()
export class LegacyBackfillService {
  private readonly logger = new Logger(LegacyBackfillService.name);

  private exchangeCodeToId: Map<string, number> | null = null;
  private sourceCodeToId: Map<string, number> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly upsertService: UpsertService,
  ) {}

  async runBatch(batchSize: number): Promise<{ taskName: BackfillTaskName | null; processed: number }> {
    for (const taskName of BACKFILL_TASK_ORDER) {
      const state = await this.getOrCreateState(taskName);
      if (state.status === 'completed') {
        continue;
      }

      const result = await this.executeTask(taskName, state.cursor, batchSize);
      if (result.rowCount === 0) {
        await this.saveState(taskName, state.cursor, 'completed');
        this.logger.log(`Backfill task ${taskName} completed`);
        continue;
      }

      await this.saveState(taskName, result.nextCursor, 'running');
      this.logger.log(
        `Backfill task ${taskName} processed batch: rows=${result.rowCount}, canonical=${result.processed}, cursor=${result.nextCursor}`,
      );
      return { taskName, processed: result.processed };
    }

    return { taskName: null, processed: 0 };
  }

  private async executeTask(
    taskName: BackfillTaskName,
    cursor: string | null,
    batchSize: number,
  ): Promise<TaskBatchResult> {
    switch (taskName) {
      case 'symbols':
        return this.backfillSymbols(cursor, batchSize);
      case 'quote_intraday':
        return this.backfillQuoteIntraday(cursor, batchSize);
      case 'quote_daily':
        return this.backfillQuoteDaily(cursor, batchSize);
      case 'foreign_trading_daily':
        return this.backfillForeignTrading(cursor, batchSize);
      case 'insider_trading_events':
        return this.backfillInsiderEvents(cursor, batchSize);
      case 'stock_related_peers':
        return this.backfillStockRelatedPeers(cursor, batchSize);
      case 'company_subsidiaries':
        return this.backfillCompanySubsidiaries(cursor, batchSize);
      case 'company_reports':
        return this.backfillCompanyReports(cursor, batchSize);
      case 'news_articles':
        return this.backfillNewsArticles(cursor, batchSize);
      default:
        return { rowCount: 0, processed: 0, nextCursor: cursor };
    }
  }

  private async backfillSymbols(cursor: string | null, batchSize: number): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'symbols';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const exchangeMap = await this.getExchangeCodeToId();
    const fallbackExchangeId = exchangeMap.get('UPCOM') || [...exchangeMap.values()][0];
    if (!fallbackExchangeId) {
      throw new Error('No exchange rows found in canonical table "exchange"');
    }

    const mappedRows: CanonicalSymbolUpsertRow[] = [];
    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const ticker = this.normalizeTicker(this.readString(row, ['symbol', 'ticker']));
      if (!ticker) {
        await this.recordError(taskName, legacyPk, 'Missing ticker in legacy symbols row', row);
        continue;
      }

      const exchangeCodeRaw = this.readString(row, ['exchange']);
      const exchangeCode = this.normalizeExchangeCode(exchangeCodeRaw);
      const exchangeId = exchangeMap.get(exchangeCode) || fallbackExchangeId;

      const status = this.readString(row, ['status']);
      mappedRows.push({
        ticker,
        exchangeId,
        companyName: this.readString(row, ['name', 'company_name']),
        industry: this.readString(row, ['industryCode', 'industry']),
        isin: this.readString(row, ['isin']),
        isActive: !status || status.toUpperCase() === 'ACTIVE',
        listedAt: this.readDate(row, ['listedAt', 'listed_at']),
      });
    }

    const processed = await this.upsertCanonicalSymbols(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed, nextCursor };
  }

  private async backfillQuoteIntraday(
    cursor: string | null,
    batchSize: number,
  ): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'quote_intraday';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const symbolMap = await this.resolveCanonicalSymbolIds(
      rows
        .map((row) => this.readString(row, ['symbolId', 'symbolid']))
        .filter((value): value is string => Boolean(value)),
    );

    const mappedRows: Array<{
      symbolId: number;
      interval: string;
      ts: Date;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
      sourceId: number;
    }> = [];

    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const legacySymbolId = this.readString(row, ['symbolId', 'symbolid']);
      if (!legacySymbolId || !symbolMap.has(legacySymbolId)) {
        await this.recordError(taskName, legacyPk, 'Symbol mapping not found', row);
        continue;
      }

      const ts = this.readDate(row, ['ts']);
      const price = this.readNumber(row, ['price']);
      if (!ts || price === null) {
        await this.recordError(taskName, legacyPk, 'Missing ts/price in quote_intraday', row);
        continue;
      }

      const sourceId = await this.resolveSourceId(this.readString(row, ['source']), 'SIMPLIZE_API');
      const priceString = String(price);
      mappedRows.push({
        symbolId: symbolMap.get(legacySymbolId)!,
        interval: CandleInterval.INTRADAY_15M,
        ts,
        open: priceString,
        high: priceString,
        low: priceString,
        close: priceString,
        volume: this.readBigintString(row, ['volume']) || '0',
        sourceId,
      });
    }

    const result = await this.upsertService.upsertStockCandles(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed: result.processed, nextCursor };
  }

  private async backfillQuoteDaily(cursor: string | null, batchSize: number): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'quote_daily';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const symbolMap = await this.resolveCanonicalSymbolIds(
      rows
        .map((row) => this.readString(row, ['symbolId', 'symbolid']))
        .filter((value): value is string => Boolean(value)),
    );

    const mappedRows: Array<{
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
    }> = [];

    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const legacySymbolId = this.readString(row, ['symbolId', 'symbolid']);
      if (!legacySymbolId || !symbolMap.has(legacySymbolId)) {
        await this.recordError(taskName, legacyPk, 'Symbol mapping not found', row);
        continue;
      }

      const tradeDate = this.readDate(row, ['date']);
      const open = this.readNumber(row, ['open']);
      const high = this.readNumber(row, ['high']);
      const low = this.readNumber(row, ['low']);
      const close = this.readNumber(row, ['close']);

      if (!tradeDate || open === null || high === null || low === null || close === null) {
        await this.recordError(
          taskName,
          legacyPk,
          'Missing date/open/high/low/close in quote_daily',
          row,
        );
        continue;
      }

      const sourceId = await this.resolveSourceId(this.readString(row, ['source']), 'SIMPLIZE_API');
      mappedRows.push({
        symbolId: symbolMap.get(legacySymbolId)!,
        interval: CandleInterval.DAILY,
        ts: tradeDate,
        open: String(open),
        high: String(high),
        low: String(low),
        close: String(close),
        volume: this.readBigintString(row, ['volume']) || '0',
        value: this.readNumericString(row, ['value']) || undefined,
        foreignBuyVolume: this.readBigintString(row, ['foreignBuyVolume']) || undefined,
        foreignSellVolume: this.readBigintString(row, ['foreignSellVolume']) || undefined,
        foreignNetVolume: this.readBigintString(row, ['foreignNetVolume']) || undefined,
        putThroughVolume: this.readBigintString(row, ['putThroughVolume']) || undefined,
        putThroughValue: this.readNumericString(row, ['putThroughValue']) || undefined,
        totalTrades: this.readBigintString(row, ['totalTrades']) || undefined,
        sourceId,
      });
    }

    const result = await this.upsertService.upsertStockCandles(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed: result.processed, nextCursor };
  }

  private async backfillForeignTrading(
    cursor: string | null,
    batchSize: number,
  ): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'foreign_trading_daily';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const symbolMap = await this.resolveCanonicalSymbolIds(
      rows
        .map((row) => this.readString(row, ['symbolId', 'symbolid']))
        .filter((value): value is string => Boolean(value)),
    );

    const mappedRows: Array<{
      symbolId: number;
      tradeDate: Date;
      buyVolume?: string;
      sellVolume?: string;
      netVolume?: string;
      buyValue?: string;
      sellValue?: string;
      netValue?: string;
      sourceId: number;
    }> = [];

    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const legacySymbolId = this.readString(row, ['symbolId', 'symbolid']);
      if (!legacySymbolId || !symbolMap.has(legacySymbolId)) {
        await this.recordError(taskName, legacyPk, 'Symbol mapping not found', row);
        continue;
      }

      const tradeDate = this.readDate(row, ['date']);
      if (!tradeDate) {
        await this.recordError(taskName, legacyPk, 'Missing date in foreign_trading_daily', row);
        continue;
      }

      const sourceId = await this.resolveSourceId(this.readString(row, ['source']), 'SIMPLIZE_API');
      mappedRows.push({
        symbolId: symbolMap.get(legacySymbolId)!,
        tradeDate,
        buyVolume: this.readBigintString(row, ['buyVolume']) || undefined,
        sellVolume: this.readBigintString(row, ['sellVolume']) || undefined,
        netVolume: this.readBigintString(row, ['netVolume']) || undefined,
        buyValue: this.readNumericString(row, ['buyValue']) || undefined,
        sellValue: this.readNumericString(row, ['sellValue']) || undefined,
        netValue: this.readNumericString(row, ['netValue']) || undefined,
        sourceId,
      });
    }

    const result = await this.upsertService.upsertStockForeignTradingDaily(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed: result.processed, nextCursor };
  }

  private async backfillInsiderEvents(
    cursor: string | null,
    batchSize: number,
  ): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'insider_trading_events';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const symbolMap = await this.resolveCanonicalSymbolIds(
      rows
        .map((row) => this.readString(row, ['symbolId', 'symbolid']))
        .filter((value): value is string => Boolean(value)),
    );

    const mappedRows: Array<{
      symbolId: number;
      announceDate?: Date;
      transactionDate: Date;
      insiderName?: string;
      insiderRole?: string;
      actionType?: string;
      dealMethod?: string;
      quantityExecuted?: string;
      avgPrice?: string;
      ownershipAfter?: string;
      sourceId: number;
    }> = [];

    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const legacySymbolId = this.readString(row, ['symbolId', 'symbolid']);
      if (!legacySymbolId || !symbolMap.has(legacySymbolId)) {
        await this.recordError(taskName, legacyPk, 'Symbol mapping not found', row);
        continue;
      }

      const transactionDate = this.readDate(row, ['transactionDate']);
      if (!transactionDate) {
        await this.recordError(taskName, legacyPk, 'Missing transactionDate in insider event', row);
        continue;
      }

      const sourceId = await this.resolveSourceId(this.readString(row, ['source']), 'SIMPLIZE_API');
      mappedRows.push({
        symbolId: symbolMap.get(legacySymbolId)!,
        announceDate: this.readDate(row, ['announceDate']) || undefined,
        transactionDate,
        insiderName: this.readString(row, ['insiderName']) || undefined,
        insiderRole: this.readString(row, ['insiderRole']) || undefined,
        actionType:
          this.readString(row, ['actionType', 'transactionType']) || undefined,
        dealMethod: this.readString(row, ['dealMethod']) || undefined,
        quantityExecuted: this.readBigintString(row, ['quantity', 'quantityExecuted']) || undefined,
        avgPrice: this.readNumericString(row, ['price', 'avgPrice']) || undefined,
        ownershipAfter:
          this.readNumericString(row, ['ownershipAfter', 'ownershipRatio']) || undefined,
        sourceId,
      });
    }

    const result = await this.upsertService.upsertStockInsiderEvents(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed: result.processed, nextCursor };
  }

  private async backfillStockRelatedPeers(
    cursor: string | null,
    batchSize: number,
  ): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'stock_related_peers';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const symbolMap = await this.resolveCanonicalSymbolIds(
      rows
        .map((row) => this.readString(row, ['symbolId', 'symbolid']))
        .filter((value): value is string => Boolean(value)),
    );

    const mappedRows: Array<{
      symbolId: number;
      peerTicker: string;
      relationType?: string | null;
      score?: number | null;
      sourceId: number;
    }> = [];

    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const legacySymbolId = this.readString(row, ['symbolId', 'symbolid']);
      if (!legacySymbolId || !symbolMap.has(legacySymbolId)) {
        await this.recordError(taskName, legacyPk, 'Symbol mapping not found', row);
        continue;
      }

      const peerTicker = this.normalizeTicker(this.readString(row, ['peerTicker']));
      if (!peerTicker) {
        await this.recordError(taskName, legacyPk, 'Missing peerTicker in stock_related_peers', row);
        continue;
      }

      const sourceId = await this.resolveSourceId(this.readString(row, ['source']), 'SIMPLIZE_API');
      mappedRows.push({
        symbolId: symbolMap.get(legacySymbolId)!,
        peerTicker,
        relationType: this.readString(row, ['relationType']),
        score: this.readNumber(row, ['score']),
        sourceId,
      });
    }

    const result = await this.upsertService.upsertStockRelatedPeers(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed: result.processed, nextCursor };
  }

  private async backfillCompanySubsidiaries(
    cursor: string | null,
    batchSize: number,
  ): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'company_subsidiaries';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const symbolMap = await this.resolveCanonicalSymbolIds(
      rows
        .map((row) => this.readString(row, ['parentSymbolId']))
        .filter((value): value is string => Boolean(value)),
    );

    const mappedRows: Array<{
      parentSymbolId: number;
      subsidiaryName: string;
      ownershipPercent?: number | null;
      relationshipType?: string | null;
      sourceId: number;
    }> = [];

    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const legacyParentSymbolId = this.readString(row, ['parentSymbolId']);
      if (!legacyParentSymbolId || !symbolMap.has(legacyParentSymbolId)) {
        await this.recordError(taskName, legacyPk, 'Parent symbol mapping not found', row);
        continue;
      }

      const subsidiaryName = this.readString(row, ['subsidiaryName']);
      if (!subsidiaryName) {
        await this.recordError(
          taskName,
          legacyPk,
          'Missing subsidiaryName in company_subsidiaries',
          row,
        );
        continue;
      }

      const sourceId = await this.resolveSourceId(this.readString(row, ['source']), 'SIMPLIZE_API');
      mappedRows.push({
        parentSymbolId: symbolMap.get(legacyParentSymbolId)!,
        subsidiaryName,
        ownershipPercent: this.readNumber(row, ['ownershipPercent']),
        relationshipType: this.readString(row, ['relationshipType']),
        sourceId,
      });
    }

    const result = await this.upsertService.upsertCompanySubsidiaries(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed: result.processed, nextCursor };
  }

  private async backfillCompanyReports(
    cursor: string | null,
    batchSize: number,
  ): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'company_reports';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const symbolMap = await this.resolveCanonicalSymbolIds(
      rows
        .map((row) => this.readString(row, ['symbolId', 'symbolid']))
        .filter((value): value is string => Boolean(value)),
    );

    const mappedRows: Array<{
      symbolId: number;
      reportType: string;
      title?: string | null;
      publishedAt?: Date | null;
      fileUrl: string;
      fileUrlHash: string;
      sourceId: number;
    }> = [];

    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const legacySymbolId = this.readString(row, ['symbolId', 'symbolid']);
      if (!legacySymbolId || !symbolMap.has(legacySymbolId)) {
        await this.recordError(taskName, legacyPk, 'Symbol mapping not found', row);
        continue;
      }

      const fileUrl = this.readString(row, ['fileUrl']);
      if (!fileUrl) {
        await this.recordError(taskName, legacyPk, 'Missing fileUrl in company_reports', row);
        continue;
      }

      const sourceId = await this.resolveSourceId(this.readString(row, ['source']), 'SIMPLIZE_API');
      mappedRows.push({
        symbolId: symbolMap.get(legacySymbolId)!,
        reportType: this.readString(row, ['reportType']) || 'unknown',
        title: this.readString(row, ['title']),
        publishedAt: this.readDate(row, ['publishedAt']),
        fileUrl,
        fileUrlHash: this.readString(row, ['fileUrlHash']) || this.upsertService.computeUrlHash(fileUrl),
        sourceId,
      });
    }

    const result = await this.upsertService.upsertCompanyReports(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed: result.processed, nextCursor };
  }

  private async backfillNewsArticles(
    cursor: string | null,
    batchSize: number,
  ): Promise<TaskBatchResult> {
    const taskName: BackfillTaskName = 'news_articles';
    const rows = await this.loadLegacyBatch(taskName, cursor, batchSize);
    if (rows.length === 0) {
      return { rowCount: 0, processed: 0, nextCursor: cursor };
    }

    const mappedRows: Array<{
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
    }> = [];

    for (const row of rows) {
      const legacyPk = this.extractRowId(row);
      const url = this.readString(row, ['url']);
      if (!url) {
        await this.recordError(taskName, legacyPk, 'Missing url in news_articles', row);
        continue;
      }

      const sourceId = await this.resolveSourceId(this.readString(row, ['source']), 'CAFEF_HTML');
      const publishedAt = this.readDate(row, ['publishedAt']);
      const sourceCreatedAt = this.readDate(row, ['sourceCreatedAt']);
      const sourceUpdatedAt = this.readDate(row, ['sourceUpdatedAt']);
      const fetchedAt = this.readDate(row, ['fetchedAt']) || new Date();

      mappedRows.push({
        sourceId,
        url,
        publishedAt: publishedAt || undefined,
        title: this.readString(row, ['title']) || url,
        summary: this.readString(row, ['summary']) || undefined,
        subtitle: this.readString(row, ['subtitle']) || undefined,
        content: this.readString(row, ['content']) || undefined,
        tickers: this.readStringArray(row, ['tickers']) || undefined,
        tags: this.readStringArray(row, ['tags']) || undefined,
        providerNewsId: this.readString(row, ['providerNewsId']) || undefined,
        langCode: this.readString(row, ['languageCode']) || undefined,
        sourceLink: this.readString(row, ['sourceLink']) || undefined,
        newsImageUrl: this.readString(row, ['imageUrl']) || undefined,
        sourceCreatedAt: sourceCreatedAt || undefined,
        sourceUpdatedAt: sourceUpdatedAt || undefined,
        fetchedAt,
      });
    }

    const result = await this.upsertService.upsertNewsArticles(mappedRows);
    const nextCursor = this.extractRowId(rows[rows.length - 1]) || cursor;
    return { rowCount: rows.length, processed: result.processed, nextCursor };
  }

  private async loadLegacyBatch(
    tableName: string,
    cursor: string | null,
    batchSize: number,
  ): Promise<Array<Record<string, unknown>>> {
    if (cursor) {
      return this.dataSource.query(
        `SELECT * FROM "${tableName}" WHERE "id"::text > $1 ORDER BY "id"::text ASC LIMIT $2`,
        [cursor, batchSize],
      );
    }

    return this.dataSource.query(
      `SELECT * FROM "${tableName}" ORDER BY "id"::text ASC LIMIT $1`,
      [batchSize],
    );
  }

  private async getOrCreateState(taskName: BackfillTaskName): Promise<BackfillState> {
    const rows = await this.dataSource.query(
      `SELECT "task_name", "cursor", "status" FROM "legacy_backfill_state" WHERE "task_name" = $1`,
      [taskName],
    );
    if (rows.length > 0) {
      const row = rows[0] as Record<string, unknown>;
      return {
        taskName,
        cursor: this.readString(row, ['cursor']),
        status: this.readString(row, ['status']) || 'pending',
      };
    }

    await this.saveState(taskName, null, 'pending');
    return { taskName, cursor: null, status: 'pending' };
  }

  private async saveState(
    taskName: BackfillTaskName,
    cursor: string | null,
    status: string,
  ): Promise<void> {
    await this.dataSource.query(
      `
        INSERT INTO "legacy_backfill_state" ("task_name", "cursor", "status", "updated_at")
        VALUES ($1, $2, $3, now())
        ON CONFLICT ("task_name")
        DO UPDATE SET
          "cursor" = EXCLUDED."cursor",
          "status" = EXCLUDED."status",
          "updated_at" = now()
      `,
      [taskName, cursor, status],
    );
  }

  private async recordError(
    taskName: BackfillTaskName,
    legacyPk: string | null,
    reason: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.dataSource.query(
      `
        INSERT INTO "legacy_backfill_error" ("task_name", "legacy_pk", "reason", "payload", "created_at")
        VALUES ($1, $2, $3, $4::jsonb, now())
      `,
      [taskName, legacyPk, reason, JSON.stringify(payload)],
    );
  }

  private async upsertCanonicalSymbols(rows: CanonicalSymbolUpsertRow[]): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const chunkSize = 500;
    let total = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      chunk.forEach((row, index) => {
        const base = index * 7;
        placeholders.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`,
        );
        values.push(
          row.ticker,
          row.exchangeId,
          row.companyName,
          row.industry,
          row.isin,
          row.isActive,
          row.listedAt,
        );
      });

      await this.dataSource.query(
        `
          INSERT INTO "symbol"
            ("ticker", "exchange_id", "company_name", "industry", "isin", "is_active", "listed_at")
          VALUES ${placeholders.join(', ')}
          ON CONFLICT ("ticker")
          DO UPDATE SET
            "exchange_id" = EXCLUDED."exchange_id",
            "company_name" = EXCLUDED."company_name",
            "industry" = EXCLUDED."industry",
            "isin" = EXCLUDED."isin",
            "is_active" = EXCLUDED."is_active",
            "listed_at" = COALESCE(EXCLUDED."listed_at", "symbol"."listed_at"),
            "updated_at" = now()
        `,
        values,
      );
      total += chunk.length;
    }

    return total;
  }

  private async resolveCanonicalSymbolIds(legacySymbolIds: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(legacySymbolIds.filter(Boolean))];
    if (unique.length === 0) {
      return new Map<string, number>();
    }

    const rows = (await this.dataSource.query(
      `
        SELECT l."id"::text AS legacy_id, c."id" AS canonical_id
        FROM "symbols" l
        JOIN "symbol" c ON UPPER(c."ticker") = UPPER(l."symbol")
        WHERE l."id" = ANY($1::uuid[])
      `,
      [unique],
    )) as Array<{ legacy_id: string; canonical_id: number }>;

    return new Map(rows.map((row) => [row.legacy_id, row.canonical_id]));
  }

  private async getExchangeCodeToId(): Promise<Map<string, number>> {
    if (this.exchangeCodeToId) {
      return this.exchangeCodeToId;
    }

    const rows = (await this.dataSource.query(
      `SELECT "code", "id" FROM "exchange"`,
    )) as Array<{ code: string; id: number }>;
    this.exchangeCodeToId = new Map(rows.map((row) => [row.code.toUpperCase(), row.id]));
    return this.exchangeCodeToId;
  }

  private async getSourceCodeToId(): Promise<Map<string, number>> {
    if (this.sourceCodeToId) {
      return this.sourceCodeToId;
    }

    const rows = (await this.dataSource.query(
      `SELECT "code", "id" FROM "data_source"`,
    )) as Array<{ code: string; id: number }>;
    this.sourceCodeToId = new Map(rows.map((row) => [row.code.toUpperCase(), row.id]));
    return this.sourceCodeToId;
  }

  private async resolveSourceId(rawSource: string | null, fallbackCode: string): Promise<number> {
    const sourceMap = await this.getSourceCodeToId();
    const mappedCode = this.mapLegacySourceToCanonicalCode(rawSource);
    const fallback = sourceMap.get(fallbackCode.toUpperCase());
    const resolved = (mappedCode && sourceMap.get(mappedCode)) || fallback;

    if (resolved) {
      return resolved;
    }

    const first = sourceMap.values().next().value as number | undefined;
    if (!first) {
      throw new Error('No rows found in data_source table');
    }
    return first;
  }

  private mapLegacySourceToCanonicalCode(rawSource: string | null): string | null {
    if (!rawSource) {
      return null;
    }
    const normalized = rawSource.trim().toUpperCase();
    if (normalized.includes('SIMPLIZE')) {
      return 'SIMPLIZE_API';
    }
    if (normalized.includes('TCBS')) {
      return 'TCBS_API';
    }
    if (normalized.includes('SSI')) {
      return 'SSI_API';
    }
    if (normalized.includes('VNDIRECT')) {
      return 'VNDIRECT_HTML';
    }
    if (normalized.includes('CAFEF')) {
      return 'CAFEF_HTML';
    }
    if (normalized.includes('SJC')) {
      return 'SJC_HTML';
    }
    if (normalized.includes('VNAPPMOB')) {
      return 'VNAPPMOB_GOLD';
    }
    return null;
  }

  private extractRowId(row: Record<string, unknown>): string | null {
    const value = this.readString(row, ['id']);
    return value || null;
  }

  private readString(row: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string') {
        return value;
      }
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
    return null;
  }

  private readNumber(row: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  private readDate(row: Record<string, unknown>, keys: string[]): Date | null {
    for (const key of keys) {
      const value = row[key];
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return null;
  }

  private readBigintString(row: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value).toString();
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
    }
    return null;
  }

  private readNumericString(row: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }
    return null;
  }

  private readStringArray(row: Record<string, unknown>, keys: string[]): string[] | null {
    for (const key of keys) {
      const value = row[key];
      if (Array.isArray(value)) {
        return value.map((item) => String(item));
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const items = trimmed
            .slice(1, -1)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
          return items.length > 0 ? items : null;
        }
      }
    }
    return null;
  }

  private normalizeTicker(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeExchangeCode(value: string | null): string {
    const normalized = value ? value.trim().toUpperCase() : '';
    if (normalized === 'HSX') {
      return 'HOSE';
    }
    if (normalized === 'UPCOM') {
      return 'UPCOM';
    }
    if (normalized === 'HNX') {
      return 'HNX';
    }
    if (normalized === 'HOSE') {
      return 'HOSE';
    }
    return 'UPCOM';
  }
}
