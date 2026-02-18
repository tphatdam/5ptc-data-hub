import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { HttpClientService } from '../http-client.service';

@Injectable()
export class SimplizeService {
  private readonly logger = new Logger(SimplizeService.name);
  readonly name = 'SIMPLIZE';

  private readonly baseUrl: string;
  private readonly authToken?: string;

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService,
  ) {
    const baseUrl =
      this.configService.get<string>('simplize.baseUrl') || 'https://api2.simplize.vn';
    this.baseUrl = baseUrl.replace(/\/+$/, '');

    const authToken = this.configService.get<string>('simplize.authToken');
    this.authToken = authToken && authToken.trim().length > 0 ? authToken.trim() : undefined;
  }

  getLatestQuote(ticker: string): Promise<any> {
    return this.get(`/api/historical/quote/${encodeURIComponent(ticker)}`);
  }

  async getFullPriceHistory(ticker: string): Promise<any[]> {
    const size = 1000;
    const rows: any[] = [];

    const firstTry = await this.getPriceHistoryPage(ticker, 0, size);
    if (firstTry.length > 0) {
      rows.push(...firstTry);
      for (let page = 1; ; page += 1) {
        const next = await this.getPriceHistoryPage(ticker, page, size);
        if (next.length === 0) {
          break;
        }
        rows.push(...next);
      }
      return rows;
    }

    const secondTry = await this.getPriceHistoryPage(ticker, 1, size);
    if (secondTry.length === 0) {
      return [];
    }

    rows.push(...secondTry);
    for (let page = 2; ; page += 1) {
      const next = await this.getPriceHistoryPage(ticker, page, size);
      if (next.length === 0) {
        break;
      }
      rows.push(...next);
    }

    return rows;
  }

  getForeignTrading(ticker: string): Promise<any> {
    return this.get(`/api/historical/foreign/trade/${encodeURIComponent(ticker)}`);
  }

  getInsiderTimeline(ticker: string): Promise<any> {
    return this.get(
      `/api/company/ownership/insider-trading-timeline/${encodeURIComponent(ticker)}`,
    );
  }

  getRelatedCompanies(ticker: string): Promise<any> {
    return this.get(`/api/company/company-related/${encodeURIComponent(ticker)}`);
  }

  getSubCompanies(ticker: string): Promise<any> {
    return this.get(`/api/company/sub-company/${encodeURIComponent(ticker)}`);
  }

  getCompanyReports(
    ticker: string,
    reportType: string,
    page: number,
    size: number,
  ): Promise<any> {
    return this.get(`/api/company/documents/list`, {
      params: {
        ticker,
        type: reportType,
        page,
        size,
      },
    });
  }

  getNewsEvents(ticker: string, typeId: string, page: number, size: number): Promise<any> {
    return this.get(`/api/company/events/list`, {
      params: {
        ticker,
        type: typeId,
        page,
        size,
      },
    });
  }

  private async getPriceHistoryPage(
    ticker: string,
    page: number,
    size: number,
  ): Promise<any[]> {
    const payload = await this.get(
      `/api/historical/quote/prices/${encodeURIComponent(ticker)}`,
      {
        params: { page, size },
      },
    );

    const list = this.extractList(payload);
    this.logger.debug(
      `Fetched price history page ${page} (size=${size}) for ${ticker}: ${list.length} rows`,
    );
    return list;
  }

  private async get(path: string, config?: AxiosRequestConfig): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers = this.buildHeaders();
    return this.httpClient.get(url, { ...config, headers: { ...headers, ...(config?.headers || {}) } });
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://simplize.vn',
      Referer: 'https://simplize.vn/',
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    return headers;
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
}

