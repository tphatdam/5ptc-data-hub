import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { SeedHttpClient } from '../http/seed-http.client';
import { SeedData, SeedSource } from './seed.source.interface';
import type { ExchangeDTO, SymbolDTO } from './seed.dto';

const EXCHANGE_CODE_MAP: Record<string, string> = {
  HSX: 'HOSE',
  HOSE: 'HOSE',
  HNX: 'HNX',
  UPCOM: 'UPCOM',
};

function normalizeExchangeCode(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return 'HOSE';
  const upper = raw.trim().toUpperCase();
  return EXCHANGE_CODE_MAP[upper] ?? (upper === 'HOSE' || upper === 'HNX' || upper === 'UPCOM' ? upper : 'HOSE');
}

function parseListedAt(value: unknown): Date | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (!str) return undefined;
  const d = new Date(str);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class SStockSeedSource implements SeedSource {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: SeedHttpClient,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SStockSeedSource.name);
  }

  async fetchAll(): Promise<SeedData> {
    const baseUrl = this.configService.get<string>('seed.sstockBaseUrl') ?? 'https://api-feature.sstock.vn';
    const cookie = this.configService.get<string>('seed.sstockCookie') ?? '';
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/company/all`;

    const headers: Record<string, string> = {};
    if (cookie) {
      headers.Cookie = cookie;
    }

    const { data, status } = await this.httpClient.get<unknown>(url, {
      headers,
    });

    if (status !== 200) {
      this.logger.warn({ status, url: baseUrl }, 'SStock API returned non-200 (redacted)');
      throw new Error(`SStock API returned ${status}`);
    }

    return this.mapResponseToSeedData(data);
  }

  private mapResponseToSeedData(raw: unknown): SeedData {
    const exchangesMap = new Map<string, ExchangeDTO>();
    const symbols: SymbolDTO[] = [];
    const indices: { code: string; name: string; exchangeCode?: string }[] = [];

    let items: unknown[] = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && typeof raw === 'object' && Array.isArray((raw as any).data)) {
      items = (raw as any).data;
    } else if (raw && typeof raw === 'object' && Array.isArray((raw as any).companies)) {
      items = (raw as any).companies;
    } else if (raw && typeof raw === 'object' && Array.isArray((raw as any).list)) {
      items = (raw as any).list;
    }

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;

      const tickerRaw = obj.code ?? obj.ticker ?? obj.symbol;
      const ticker = tickerRaw != null ? String(tickerRaw).trim() : '';
      if (!ticker) continue;

      const exchangeCodeRaw =
        obj.exchange ?? obj.floor ?? obj.market ?? obj.exchangeCode;
      const exchangeCode = normalizeExchangeCode(
        exchangeCodeRaw != null ? String(exchangeCodeRaw) : undefined,
      );

      exchangesMap.set(exchangeCode, {
        code: exchangeCode,
        name:
          exchangeCode === 'HOSE'
            ? 'Ho Chi Minh Stock Exchange'
            : exchangeCode === 'HNX'
              ? 'Hanoi Stock Exchange'
              : 'Unlisted Public Company Market',
      });

      const companyName =
        obj.name ?? obj.companyName ?? obj.company_name;
      const industry =
        obj.sector ?? obj.industry ?? obj.sectorName;
      const isin = obj.isin != null ? String(obj.isin) : undefined;
      const listedAt = parseListedAt(obj.listedAt ?? obj.listed_at ?? obj.listDate);

      symbols.push({
        ticker,
        exchangeCode,
        companyName: companyName != null ? String(companyName) : undefined,
        industry: industry != null ? String(industry) : undefined,
        isin: isin && isin.length <= 20 ? isin : undefined,
        listedAt,
      });
    }

    const exchanges = Array.from(exchangesMap.values());
    return {
      exchanges,
      symbols,
      indices,
    };
  }
}
