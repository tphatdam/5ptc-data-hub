import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://sstock.vn',
  Referer: 'https://sstock.vn/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function shouldNotRetry(status: number): boolean {
  return status === 401 || status === 403 || (status >= 400 && status < 500 && status !== 429);
}

function delayWithJitter(baseMs: number, attempt: number): number {
  const exponential = Math.pow(2, attempt) * baseMs;
  const jitter = Math.random() * 0.3 * exponential;
  return Math.min(exponential + jitter, 30000);
}

@Injectable()
export class SeedHttpClient {
  private readonly client: AxiosInstance;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs =
      this.configService.get<number>('seed.httpTimeoutMs') ?? 20000;
    this.maxRetries =
      this.configService.get<number>('seed.httpRetries') ?? 4;

    this.client = axios.create({
      timeout: this.timeoutMs,
      headers: { ...DEFAULT_HEADERS },
      validateStatus: () => true,
    });
  }

  async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig & { headers?: Record<string, string> },
  ): Promise<{ data: T; status: number }> {
    const mergedConfig: AxiosRequestConfig = {
      ...config,
      headers: { ...DEFAULT_HEADERS, ...config?.headers },
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.get<T>(url, mergedConfig);
        const status = response.status;

        if (status >= 200 && status < 300) {
          return { data: response.data, status };
        }

        if (shouldNotRetry(status)) {
          const err = new Error(
            `HTTP ${status}`,
          ) as Error & { status?: number };
          (err as any).status = status;
          (err as any).response = response;
          throw err;
        }

        if (isRetryableStatus(status) && attempt < this.maxRetries) {
          const waitMs = delayWithJitter(1000, attempt);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        const err = new Error(`HTTP ${status}`) as Error & { status?: number };
        (err as any).status = status;
        (err as any).response = response;
        throw err;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;

        if (status !== undefined && shouldNotRetry(status)) {
          throw err;
        }

        const isNetwork =
          axiosErr.code === 'ECONNABORTED' ||
          axiosErr.code === 'ETIMEDOUT' ||
          axiosErr.code === 'ENOTFOUND' ||
          axiosErr.code === 'ECONNREFUSED';

        if (isNetwork && attempt < this.maxRetries) {
          const waitMs = delayWithJitter(1000, attempt);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        throw err;
      }
    }

    throw lastError ?? new Error('Request failed');
  }
}
