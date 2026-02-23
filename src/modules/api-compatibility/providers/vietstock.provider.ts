import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
import { IStockProxyProvider } from './interfaces';

@Injectable()
export class VietstockProvider implements IStockProxyProvider {
  readonly code = 'VIETSTOCK';
  private readonly baseUrl: string;
  private readonly cookie: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('vietstock.base') ||
      process.env.VIETSTOCK_BASE ||
      '';
    this.cookie =
      this.configService.get<string>('vietstock.cookie') ||
      process.env.VIETSTOCK_COOKIE;
  }

  async get(path: string, query?: Record<string, string>): Promise<unknown> {
    const url = new URL(path.startsWith('http') ? path : `${this.baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const config: AxiosRequestConfig = {
      headers: {
        Accept: 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
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
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      timeout: 30000,
    };
    const res = await firstValueFrom(this.httpService.post<unknown>(url, body ?? {}, config));
    return res.data;
  }
}
