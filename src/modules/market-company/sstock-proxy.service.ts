import { Injectable } from '@nestjs/common';
import { SStockApiProvider } from '../api-compatibility/providers/sstock-api.provider';

@Injectable()
export class SStockProxyService {
  constructor(private readonly sstock: SStockApiProvider) {}

  async proxyGet(path: string, query?: Record<string, string>): Promise<unknown> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return this.sstock.get(normalizedPath, query);
  }

  async proxyPost(path: string, body?: unknown): Promise<unknown> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return this.sstock.post(normalizedPath, body);
  }
}
