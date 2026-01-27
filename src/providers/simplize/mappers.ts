import { createHash } from 'crypto';
import { BulkUpsertCompanyReportDto } from '../../company-data/company-report.repository';
import { BulkUpsertCompanySubsidiaryDto } from '../../company-data/company-subsidiary.repository';
import { BulkUpsertForeignTradingDailyDto } from '../../company-data/foreign-trading-daily.repository';
import { BulkUpsertInsiderTradingEventDto } from '../../company-data/insider-trading-event.repository';
import { BulkUpsertNewsArticleDto } from '../../company-data/news-article.repository';
import { BulkUpsertStockRelatedPeerDto } from '../../company-data/stock-related-peer.repository';
import { BulkUpsertQuoteDailyDto } from '../../quotes/quote-daily.repository';
import { BulkUpsertQuoteIntradayDto } from '../../quotes/quote-intraday.repository';

const SOURCE = 'SIMPLIZE';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function mapLatestQuoteToIntraday(
  quote: any,
  symbolId: string,
  now: Date,
): BulkUpsertQuoteIntradayDto {
  const price = pickFirstNumber(quote, [
    'last',
    'lastPrice',
    'price',
    'currentPrice',
    'close',
    'closePrice',
    'c',
  ]);

  const volumeRaw = pickFirstValue(quote, [
    'volume',
    'totalVolume',
    'matchVolume',
    'matchedVolume',
    'vol',
    'v',
  ]);

  return {
    symbolId,
    ts: now,
    price: price ?? 0,
    volume: normalizeBigintString(volumeRaw) ?? '0',
    source: SOURCE,
  };
}

export function mapPriceHistoryToDailyBars(
  records: any[],
  symbolId: string,
): BulkUpsertQuoteDailyDto[] {
  const list = Array.isArray(records) ? records : [];

  return list
    .map((r) => {
      const date = parseDateOnly(pickFirstValue(r, ['date', 'tradingDate', 'day', 'd']));
      if (!date) {
        return null;
      }

      const open = pickFirstNumber(r, ['open', 'o']);
      const high = pickFirstNumber(r, ['high', 'h']);
      const low = pickFirstNumber(r, ['low', 'l']);
      const close = pickFirstNumber(r, ['close', 'c']);
      const volume = normalizeBigintString(pickFirstValue(r, ['volume', 'v', 'vol'])) ?? '0';

      return {
        symbolId,
        date,
        open: open ?? 0,
        high: high ?? 0,
        low: low ?? 0,
        close: close ?? 0,
        volume,
        source: SOURCE,
      };
    })
    .filter((x): x is BulkUpsertQuoteDailyDto => Boolean(x));
}

export function mapForeignTradingToRows(
  data: any,
  symbolId: string,
): BulkUpsertForeignTradingDailyDto[] {
  const list = extractList(data);

  return list
    .map((r) => {
      const date = parseDateOnly(pickFirstValue(r, ['date', 'tradingDate', 'day']));
      if (!date) {
        return null;
      }

      const buyVolume = normalizeBigintString(
        pickFirstValue(r, ['buyVolume', 'buy', 'buyVol', 'foreignBuyVolume']),
      );
      const sellVolume = normalizeBigintString(
        pickFirstValue(r, ['sellVolume', 'sell', 'sellVol', 'foreignSellVolume']),
      );
      const netVolume =
        normalizeBigintString(
          pickFirstValue(r, ['netVolume', 'net', 'netVol', 'foreignNetVolume']),
        ) ?? computeNetBigintString(buyVolume, sellVolume);

      return {
        symbolId,
        date,
        buyVolume,
        sellVolume,
        netVolume,
        source: SOURCE,
      };
    })
    .filter((x): x is BulkUpsertForeignTradingDailyDto => Boolean(x));
}

export function mapInsiderTimelineToRows(
  listPayload: any,
  symbolId: string,
): BulkUpsertInsiderTradingEventDto[] {
  const list = extractList(listPayload);

  return list
    .map((r) => {
      const transactionDate = parseDateOnly(
        pickFirstValue(r, ['transactionDate', 'date', 'tradingDate']),
      );
      if (!transactionDate) {
        return null;
      }

      return {
        symbolId,
        transactionDate,
        insiderName: normalizeString(pickFirstValue(r, ['insiderName', 'name'])) ?? null,
        insiderRole: normalizeString(pickFirstValue(r, ['insiderRole', 'role'])) ?? null,
        transactionType: normalizeString(pickFirstValue(r, ['transactionType', 'type'])) ?? null,
        quantity: normalizeBigintString(pickFirstValue(r, ['quantity', 'qty', 'volume'])) ?? null,
        price: pickFirstNumber(r, ['price', 'transactionPrice']) ?? null,
        source: SOURCE,
      };
    })
    .filter((x): x is BulkUpsertInsiderTradingEventDto => Boolean(x));
}

export function mapRelatedToPeers(
  listPayload: any,
  symbolId: string,
): BulkUpsertStockRelatedPeerDto[] {
  const list = extractList(listPayload);

  return list
    .map((r) => {
      const peerTickerRaw = pickFirstValue(r, ['peerTicker', 'ticker', 'symbol', 'code']);
      const peerTicker = normalizeTicker(peerTickerRaw);
      if (!peerTicker) {
        return null;
      }

      return {
        symbolId,
        peerTicker,
        relationType: normalizeString(pickFirstValue(r, ['relationType', 'type', 'relation'])) ?? null,
        score: pickFirstNumber(r, ['score', 'similarity', 'weight']) ?? null,
        source: SOURCE,
      };
    })
    .filter((x): x is BulkUpsertStockRelatedPeerDto => Boolean(x));
}

export function mapSubsidiaries(
  listPayload: any,
  parentSymbolId: string,
): BulkUpsertCompanySubsidiaryDto[] {
  const list = extractList(listPayload);

  return list
    .map((r) => {
      const subsidiaryName = normalizeString(pickFirstValue(r, ['subsidiaryName', 'name'])) ?? null;
      if (!subsidiaryName) {
        return null;
      }

      return {
        parentSymbolId,
        subsidiaryName,
        ownershipPercent: pickFirstNumber(r, ['ownershipPercent', 'ownership', 'percent']) ?? null,
        relationshipType:
          normalizeString(pickFirstValue(r, ['relationshipType', 'type', 'relation'])) ?? null,
        source: SOURCE,
      };
    })
    .filter((x): x is BulkUpsertCompanySubsidiaryDto => Boolean(x));
}

export function mapNewsEventsToArticles(
  payload: any,
  ticker: string,
  now: Date,
): BulkUpsertNewsArticleDto[] {
  const list = extractList(payload);
  const normalizedTicker = normalizeTicker(ticker);

  return list
    .map((r) => {
      const url = normalizeString(pickFirstValue(r, ['url', 'link', 'href'])) ?? null;
      if (!url) {
        return null;
      }

      const publishedAt = parseTimestamp(
        pickFirstValue(r, ['publishedAt', 'published_time', 'time', 'date']),
      );

      const tickersFromPayload = extractStringArray(pickFirstValue(r, ['tickers', 'symbols']));
      const tickers = dedupeStrings(
        [normalizedTicker, ...tickersFromPayload].filter((x): x is string => Boolean(x)),
      );

      const tags = dedupeStrings(extractStringArray(pickFirstValue(r, ['tags', 'tag'])));

      return {
        url,
        urlHash: sha256Hex(url),
        publishedAt,
        title: normalizeString(pickFirstValue(r, ['title', 'name'])) ?? url,
        summary: normalizeString(pickFirstValue(r, ['summary', 'description'])) ?? null,
        content: normalizeString(pickFirstValue(r, ['content', 'body', 'text'])) ?? null,
        tickers: tickers.length > 0 ? tickers : null,
        tags: tags.length > 0 ? tags : null,
        source: SOURCE,
        fetchedAt: now,
      };
    })
    .filter((x): x is BulkUpsertNewsArticleDto => Boolean(x));
}

export function mapReportsToRows(
  payload: any,
  symbolId: string,
  reportType: string,
): BulkUpsertCompanyReportDto[] {
  const list = extractList(payload);

  return list
    .map((r) => {
      const fileUrl = normalizeString(pickFirstValue(r, ['fileUrl', 'url', 'link', 'href'])) ?? null;
      if (!fileUrl) {
        return null;
      }

      return {
        symbolId,
        reportType,
        title: normalizeString(pickFirstValue(r, ['title', 'name'])) ?? null,
        publishedAt: parseDateOnly(pickFirstValue(r, ['publishedAt', 'date'])) ?? null,
        fileUrl,
        fileUrlHash: sha256Hex(fileUrl),
        source: SOURCE,
      };
    })
    .filter((x): x is BulkUpsertCompanyReportDto => Boolean(x));
}

function pickFirstValue(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) {
      return obj[k];
    }
  }

  return undefined;
}

function pickFirstNumber(obj: any, keys: string[]): number | null {
  const v = pickFirstValue(obj, keys);
  if (v === undefined || v === null || v === '') {
    return null;
  }
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeTicker(v: any): string | null {
  const s = normalizeString(v);
  if (!s) {
    return null;
  }
  return s.toUpperCase();
}

function normalizeString(v: any): string | null {
  if (v === undefined || v === null) {
    return null;
  }
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function normalizeBigintString(v: any): string | null {
  if (v === undefined || v === null || v === '') {
    return null;
  }

  if (typeof v === 'bigint') {
    return v.toString();
  }

  const s = String(v).replace(/,/g, '').trim();
  if (s.length === 0) {
    return null;
  }

  if (!/^-?\d+$/.test(s)) {
    const asNumber = Number(s);
    if (!Number.isFinite(asNumber)) {
      return null;
    }
    return Math.trunc(asNumber).toString();
  }

  return s;
}

function computeNetBigintString(buy: string | null, sell: string | null): string | null {
  if (!buy || !sell) {
    return null;
  }
  try {
    return (BigInt(buy) - BigInt(sell)).toString();
  } catch {
    return null;
  }
}

function parseDateOnly(v: any): Date | null {
  if (v === undefined || v === null || v === '') {
    return null;
  }
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  const s = String(v).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseTimestamp(v: any): Date | null {
  if (v === undefined || v === null || v === '') {
    return null;
  }
  if (v instanceof Date) {
    return v;
  }
  const s = String(v).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function extractList(payload: any): any[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (Array.isArray(payload.items)) {
    return payload.items;
  }
  if (payload.data && Array.isArray(payload.data.items)) {
    return payload.data.items;
  }
  if (payload.data && Array.isArray(payload.data.data)) {
    return payload.data.data;
  }
  if (payload.result && Array.isArray(payload.result.items)) {
    return payload.result.items;
  }
  return [];
}

function extractStringArray(v: any): string[] {
  if (!v) {
    return [];
  }

  if (Array.isArray(v)) {
    return v.map((x) => normalizeString(x)).filter((x): x is string => Boolean(x));
  }

  if (typeof v === 'string') {
    return v
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }

  return [];
}

function dedupeStrings(list: string[]): string[] {
  return Array.from(new Set(list));
}

