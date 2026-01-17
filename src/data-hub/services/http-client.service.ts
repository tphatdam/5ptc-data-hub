import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import Bottleneck from 'bottleneck';

export interface HttpClientOptions {
  maxRetries?: number;
  timeout?: number;
  maxRps?: number;
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private readonly client: AxiosInstance;
  private readonly limiter: Bottleneck;
  private readonly maxRetries: number;

  constructor() {
    this.maxRetries = 3;

    this.client = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'VN-Finance-DataHub/1.0',
        'Accept': 'application/json, text/html',
      },
    });

    this.limiter = new Bottleneck({
      reservoir: 3,
      reservoirRefreshAmount: 3,
      reservoirRefreshInterval: 1000,
      maxConcurrent: 3,
    });
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.limiter.schedule(() => this.requestWithRetry<T>('GET', url, config));
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.limiter.schedule(() => this.requestWithRetry<T>('POST', url, { ...config, data }));
  }

  private async requestWithRetry<T>(
    method: string,
    url: string,
    config?: AxiosRequestConfig,
    attempt: number = 1
  ): Promise<AxiosResponse<T>> {
    try {
      const response = await this.client.request<T>({
        method,
        url,
        ...config,
      });
      return response;
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = Math.pow(2, attempt) * 500;
        this.logger.warn(
          `Request to ${url} failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms...`
        );
        await this.sleep(delay);
        return this.requestWithRetry<T>(method, url, config, attempt + 1);
      }
      this.logger.error(`Request to ${url} failed after ${this.maxRetries} attempts`);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
