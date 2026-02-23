import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from '../services/http-client.service';
import { SymbolInfo, SymbolListProvider } from './interfaces';
import { logPayload, toLogError } from '../../../common/logging/ingestion-log';

const EXCHANGE_CODE_MAP: Record<string, string> = {
  HSX: 'HOSE',
  HOSE: 'HOSE',
  HNX: 'HNX',
  UPCOM: 'UPCOM',
};

function normalizeExchangeCode(raw: unknown): string {
  if (typeof raw !== 'string') {
    return 'HOSE';
  }

  const upper = raw.trim().toUpperCase();
  if (!upper) {
    return 'HOSE';
  }

  return EXCHANGE_CODE_MAP[upper] ?? (upper === 'HOSE' || upper === 'HNX' || upper === 'UPCOM' ? upper : 'HOSE');
}

function normalizeString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function extractItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.data)) {
    return record.data;
  }
  if (Array.isArray(record.companies)) {
    return record.companies;
  }
  if (Array.isArray(record.list)) {
    return record.list;
  }

  return [];
}

@Injectable()
export class SStockProvider implements SymbolListProvider {
  readonly code = 'SSTOCK_API';
  private readonly logger = new Logger(SStockProvider.name);
  private readonly baseUrl: string;
  private readonly cookie?: string;

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('dataHub.sstockBaseUrl') ||
      process.env.SSTOCK_BASE_URL ||
      'https://api-feature.sstock.vn';
    this.cookie =
      this.configService.get<string>('dataHub.sstockCookie') ||
      process.env.SSTOCK_COOKIE ||
      undefined;
  }

  async fetchSymbolList(): Promise<SymbolInfo[]> {
    const startedAt = Date.now();
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/company/all`;

    try {
      const response = await this.httpClient.get<unknown>(url, {
        headers: {
          Accept: 'application/json',
          Origin: 'https://sstock.vn',
          Referer: 'https://sstock.vn/',
          ...(this.cookie ? { Cookie: this.cookie } : {}),
        },
      });

      const items = extractItems(response.data);
      const symbols: SymbolInfo[] = [];

      for (const item of items) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const row = item as Record<string, unknown>;
        const ticker = normalizeString(row.code ?? row.ticker ?? row.symbol);
        if (!ticker) {
          continue;
        }

        symbols.push({
          ticker,
          exchangeCode: normalizeExchangeCode(
            row.exchange ?? row.floor ?? row.market ?? row.exchangeCode ?? row.board,
          ),
          companyName: normalizeString(
            row.name ?? row.companyName ?? row.company_name ?? row.organName,
          ),
          industry: normalizeString(row.sector ?? row.industry ?? row.sectorName ?? row.industryName),
          isin: normalizeString(row.isin),
        });
      }

      this.logger.log(
        logPayload({
          event: 'sstock_symbol_list_completed',
          module: 'data-hub.sstock-provider',
          providerCode: this.code,
          status: 'succeeded',
          processed: symbols.length,
          durationMs: Date.now() - startedAt,
        }),
      );

      return symbols;
    } catch (error: unknown) {
      this.logger.warn(
        logPayload({
          event: 'sstock_symbol_list_failed',
          module: 'data-hub.sstock-provider',
          providerCode: this.code,
          status: 'failed',
          durationMs: Date.now() - startedAt,
          error: toLogError(error),
        }),
      );
      throw error;
    }
  }
}

