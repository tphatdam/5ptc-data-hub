import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
import { IStockProxyProvider } from './interfaces';

@Injectable()
export class FireAntProvider implements IStockProxyProvider {
  readonly code = 'FIREANT';
  private readonly baseUrl: string;
  private readonly token: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('fireant.baseUrl') ||
      process.env.FIREANT_BASE_URL ||
      '';
    this.token =
      this.configService.get<string>('fireant.token') ||
      process.env.FIREANT_TOKEN;
  }

  async get(path: string, query?: Record<string, string>): Promise<unknown> {
    const url = new URL(path.startsWith('http') ? path : `${this.baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const config: AxiosRequestConfig = {
      headers: {
        Accept: 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
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
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      timeout: 30000,
    };
    const res = await firstValueFrom(this.httpService.post<unknown>(url, body ?? {}, config));
    return res.data;
  }
}
