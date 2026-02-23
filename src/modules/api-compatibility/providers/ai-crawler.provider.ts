import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
import { IStockProxyProvider } from './interfaces';

@Injectable()
export class AiCrawlerProvider implements IStockProxyProvider {
  readonly code = 'AI_CRAWLER';
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('aiCrawler.apiUrl') ||
      process.env.AI_CRAWLER_API_URL ||
      '';
  }

  async get(path: string, query?: Record<string, string>): Promise<unknown> {
    const url = new URL(path.startsWith('http') ? path : `${this.baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const config: AxiosRequestConfig = {
      headers: { Accept: 'application/json' },
      timeout: 30000,
    };
    const res = await firstValueFrom(this.httpService.get<unknown>(url.toString(), config));
    return res.data;
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    const url = path.startsWith('http') ? path : `${this.baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const config: AxiosRequestConfig = {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };
    const res = await firstValueFrom(this.httpService.post<unknown>(url, body ?? {}, config));
    return res.data;
  }
}
