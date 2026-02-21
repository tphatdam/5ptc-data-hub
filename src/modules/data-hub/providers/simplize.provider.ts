import { Injectable, Logger } from '@nestjs/common';
import { SimplizeService } from '../../providers/simplize/simplize.service';
import { ForeignTradingDailyDTO, InsiderEventDTO } from '../dto';
import { CompanyIntelProvider } from './interfaces';
import { logPayload, toLogError } from '../../../common/logging/ingestion-log';

@Injectable()
export class SimplizeProvider implements CompanyIntelProvider {
  readonly code = 'SIMPLIZE_API';
  private readonly logger = new Logger(SimplizeProvider.name);

  constructor(private readonly simplizeService: SimplizeService) {}

  async fetchForeignTradingDaily(
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<ForeignTradingDailyDTO[]> {
    const startedAt = Date.now();
    this.logFetchStarted('foreign', {
      ticker,
      from: from.toISOString(),
      to: to.toISOString(),
    });

    try {
      const payload = await this.simplizeService.getForeignTrading(ticker);
      const rows = this.extractList(payload)
        .map((row) => this.mapForeignTradingRow(ticker, row))
        .filter((row): row is ForeignTradingDailyDTO => Boolean(row));

      this.logFetchCompleted('foreign', {
        ticker,
        processed: rows.length,
        durationMs: Date.now() - startedAt,
        status: 'succeeded',
      });

      return rows;
    } catch (error: unknown) {
      this.logFetchCompleted('foreign', {
        ticker,
        durationMs: Date.now() - startedAt,
        status: 'failed',
        error: toLogError(error),
      });
      throw error;
    }
  }

  async fetchInsiderEvents(ticker: string, from: Date, to: Date): Promise<InsiderEventDTO[]> {
    const startedAt = Date.now();
    this.logFetchStarted('insider', {
      ticker,
      from: from.toISOString(),
      to: to.toISOString(),
    });

    try {
      const payload = await this.simplizeService.getInsiderTimeline(ticker);
      const rows = this.extractList(payload)
        .map((row) => this.mapInsiderRow(ticker, row))
        .filter((row): row is InsiderEventDTO => Boolean(row));

      this.logFetchCompleted('insider', {
        ticker,
        processed: rows.length,
        durationMs: Date.now() - startedAt,
        status: 'succeeded',
      });

      return rows;
    } catch (error: unknown) {
      this.logFetchCompleted('insider', {
        ticker,
        durationMs: Date.now() - startedAt,
        status: 'failed',
        error: toLogError(error),
      });
      throw error;
    }
  }

  private mapForeignTradingRow(ticker: string, row: any): ForeignTradingDailyDTO | null {
    const tradeDate = this.parseDateOnly(this.pickFirstValue(row, ['date', 'tradingDate', 'day']));

    if (!tradeDate) {
      return null;
    }

    const buyVolume = this.toNumber(
      this.pickFirstValue(row, ['buyVolume', 'buy', 'buyVol', 'foreignBuyVolume']),
    );
    const sellVolume = this.toNumber(
      this.pickFirstValue(row, ['sellVolume', 'sell', 'sellVol', 'foreignSellVolume']),
    );
    const netVolume =
      this.toNumber(this.pickFirstValue(row, ['netVolume', 'net', 'netVol', 'foreignNetVolume'])) ??
      (buyVolume !== undefined && sellVolume !== undefined ? buyVolume - sellVolume : undefined);

    return {
      ticker,
      tradeDate,
      buyVolume,
      sellVolume,
      netVolume,
      buyValue: this.toNumber(
        this.pickFirstValue(row, ['buyValue', 'buyTradingValue', 'foreignBuyValue']),
      ),
      sellValue: this.toNumber(
        this.pickFirstValue(row, ['sellValue', 'sellTradingValue', 'foreignSellValue']),
      ),
      netValue: this.toNumber(
        this.pickFirstValue(row, ['netValue', 'netTradingValue', 'foreignNetValue']),
      ),
      foreignRoom: this.toNumber(this.pickFirstValue(row, ['foreignRoom', 'foreign_total_room'])),
      foreignHoldingRoom: this.toNumber(
        this.pickFirstValue(row, ['foreignHoldingRoom', 'foreign_holding_room']),
      ),
      currentHoldingRatio: this.toNumber(
        this.pickFirstValue(row, ['currentHoldingRatio', 'current_holding_ratio']),
      ),
      maxHoldingRatio: this.toNumber(
        this.pickFirstValue(row, ['maxHoldingRatio', 'max_holding_ratio']),
      ),
      rawPayload: row,
    };
  }

  private mapInsiderRow(ticker: string, row: any): InsiderEventDTO | null {
    const transactionDate = this.parseDateOnly(
      this.pickFirstValue(row, ['transactionDate', 'date', 'tradingDate']),
    );

    if (!transactionDate) {
      return null;
    }

    return {
      ticker,
      transactionDate,
      announceDate: this.parseDateOnly(
        this.pickFirstValue(row, ['announceDate', 'publicDate', 'issueDate']),
      ),
      insiderName: this.toStringOrUndefined(this.pickFirstValue(row, ['insiderName', 'name'])),
      insiderRole: this.toStringOrUndefined(this.pickFirstValue(row, ['insiderRole', 'role'])),
      relatedPerson: this.toStringOrUndefined(
        this.pickFirstValue(row, ['relatedPerson', 'relatedName']),
      ),
      actionType: this.toStringOrUndefined(
        this.pickFirstValue(row, ['actionType', 'action', 'transactionAction']),
      ),
      dealMethod: this.toStringOrUndefined(
        this.pickFirstValue(row, ['dealMethod', 'method', 'transactionMethod']),
      ),
      status: this.toStringOrUndefined(this.pickFirstValue(row, ['status', 'progress'])),
      quantityRegistered: this.toNumber(
        this.pickFirstValue(row, ['quantityRegistered', 'registeredQty', 'registeredVolume']),
      ),
      quantityExecuted: this.toNumber(
        this.pickFirstValue(row, ['quantityExecuted', 'executedQty', 'quantity', 'volume']),
      ),
      quantityRemaining: this.toNumber(
        this.pickFirstValue(row, ['quantityRemaining', 'remainingQty']),
      ),
      priceFrom: this.toNumber(this.pickFirstValue(row, ['priceFrom', 'fromPrice'])),
      priceTo: this.toNumber(this.pickFirstValue(row, ['priceTo', 'toPrice'])),
      avgPrice: this.toNumber(this.pickFirstValue(row, ['avgPrice', 'price', 'transactionPrice'])),
      dealValue: this.toNumber(this.pickFirstValue(row, ['dealValue', 'transactionValue'])),
      ownershipBefore: this.toNumber(
        this.pickFirstValue(row, ['ownershipBefore', 'holdingBefore']),
      ),
      ownershipAfter: this.toNumber(this.pickFirstValue(row, ['ownershipAfter', 'holdingAfter'])),
      ownershipChange: this.toNumber(
        this.pickFirstValue(row, ['ownershipChange', 'holdingChange', 'ownershipRatio']),
      ),
      sourceEventId: this.toStringOrUndefined(
        this.pickFirstValue(row, ['sourceEventId', 'eventId', 'id']),
      ),
      sourceUrl: this.toStringOrUndefined(
        this.pickFirstValue(row, ['sourceUrl', 'url', 'link', 'href']),
      ),
      rawPayload: row,
    };
  }

  private pickFirstValue(obj: any, keys: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }

    return undefined;
  }

  private extractList(payload: any): any[] {
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

    return [];
  }

  private parseDateOnly(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date.toISOString().slice(0, 10);
  }

  private toNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    const normalized = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(normalized)) {
      return undefined;
    }
    return normalized;
  }

  private toStringOrUndefined(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private logFetchStarted(
    endpoint: 'foreign' | 'insider',
    metadata: Record<string, unknown>,
  ): void {
    this.logger.log(
      logPayload({
        event: 'simplize_fetch_started',
        module: 'data-hub.simplize-provider',
        providerCode: this.code,
        status: 'started',
        endpoint,
        ...metadata,
      }),
    );
  }

  private logFetchCompleted(
    endpoint: 'foreign' | 'insider',
    metadata: Record<string, unknown>,
  ): void {
    const payload = logPayload({
      event: 'simplize_fetch_completed',
      module: 'data-hub.simplize-provider',
      providerCode: this.code,
      endpoint,
      ...metadata,
    });

    if (metadata.status === 'failed') {
      this.logger.warn(payload);
      return;
    }

    this.logger.log(payload);
  }
}
