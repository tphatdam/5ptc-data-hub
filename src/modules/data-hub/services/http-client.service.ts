import { Injectable, Logger } from '@nestjs/common';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosProxyConfig,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import Bottleneck from 'bottleneck';

export type RequestMode = 'direct' | 'proxy';
export type ProxyMode = 'single' | 'random' | 'rotate' | 'try' | 'auto';

export interface RetryPolicy {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface ProxyRequestOptions {
  requestMode?: RequestMode;
  proxyMode?: ProxyMode;
  proxyList?: string[];
}

export interface DataHubRequestConfig extends AxiosRequestConfig {
  retryPolicy?: RetryPolicy;
  proxyOptions?: ProxyRequestOptions;
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private readonly client: AxiosInstance;
  private readonly limiter: Bottleneck;
  private readonly defaultRetryPolicy: Required<RetryPolicy>;
  private readonly autoProxyPool: string[];

  private proxyRotationIndex = 0;

  constructor() {
    this.defaultRetryPolicy = {
      maxRetries: 3,
      baseDelayMs: 500,
      maxDelayMs: 10000,
    };

    this.autoProxyPool = (process.env.DATA_HUB_PROXY_LIST || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    this.client = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'VN-Finance-DataHub/1.0',
        Accept: 'application/json, text/html',
      },
    });

    this.limiter = new Bottleneck({
      reservoir: 3,
      reservoirRefreshAmount: 3,
      reservoirRefreshInterval: 1000,
      maxConcurrent: 3,
    });
  }

  async get<T = unknown>(
    url: string,
    config?: DataHubRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.limiter.schedule(() => this.requestWithRetry<T>('GET', url, config, 1));
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: DataHubRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.limiter.schedule(() =>
      this.requestWithRetry<T>('POST', url, { ...config, data }, 1),
    );
  }

  private async requestWithRetry<T>(
    method: 'GET' | 'POST',
    url: string,
    config: DataHubRequestConfig | undefined,
    attempt: number,
  ): Promise<AxiosResponse<T>> {
    const retryPolicy = this.resolveRetryPolicy(config?.retryPolicy);

    try {
      return await this.requestByMode<T>(method, url, config);
    } catch (error: unknown) {
      if (attempt >= retryPolicy.maxRetries || !this.isRetryableError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Request ${method} ${url} failed after ${attempt} attempts: ${message}`,
        );
        throw error;
      }

      const delayMs = this.computeRetryDelay(error, retryPolicy, attempt);
      this.logger.warn(
        `Request ${method} ${url} failed (attempt ${attempt}/${retryPolicy.maxRetries}), retrying in ${delayMs}ms`,
      );
      await this.sleep(delayMs);

      return this.requestWithRetry(method, url, config, attempt + 1);
    }
  }

  private async requestByMode<T>(
    method: 'GET' | 'POST',
    url: string,
    config?: DataHubRequestConfig,
  ): Promise<AxiosResponse<T>> {
    const requestMode = config?.proxyOptions?.requestMode ?? 'direct';
    if (requestMode === 'proxy') {
      return this.requestViaProxyMode<T>(method, url, config);
    }
    return this.requestDirect<T>(method, url, config);
  }

  private async requestViaProxyMode<T>(
    method: 'GET' | 'POST',
    url: string,
    config?: DataHubRequestConfig,
  ): Promise<AxiosResponse<T>> {
    const proxyOptions = config?.proxyOptions;
    const proxyMode = proxyOptions?.proxyMode ?? 'try';
    const proxyCandidates = this.resolveProxyCandidates(proxyOptions);

    if (proxyCandidates.length === 0) {
      throw new Error(
        'Proxy mode is enabled but no proxies were provided (set proxyOptions.proxyList or DATA_HUB_PROXY_LIST)',
      );
    }

    if (proxyMode === 'try') {
      let lastError: unknown;
      for (const proxyUrl of proxyCandidates) {
        try {
          return await this.requestDirect<T>(
            method,
            url,
            config,
            this.parseProxyUrl(proxyUrl),
          );
        } catch (error: unknown) {
          lastError = error;
        }
      }

      throw lastError ?? new Error('All proxies failed');
    }

    const selectedProxyUrl = this.selectProxy(proxyCandidates, proxyMode);
    return this.requestDirect<T>(
      method,
      url,
      config,
      this.parseProxyUrl(selectedProxyUrl),
    );
  }

  private async requestDirect<T>(
    method: 'GET' | 'POST',
    url: string,
    config?: DataHubRequestConfig,
    proxy?: AxiosProxyConfig,
  ): Promise<AxiosResponse<T>> {
    const axiosConfig = this.toAxiosConfig(config, proxy);
    return this.client.request<T>({
      method,
      url,
      ...axiosConfig,
    });
  }

  private toAxiosConfig(
    config?: DataHubRequestConfig,
    proxy?: AxiosProxyConfig,
  ): AxiosRequestConfig {
    if (!config) {
      return proxy ? { proxy } : {};
    }

    const { retryPolicy: _retry, proxyOptions: _proxy, ...axiosConfig } = config;
    if (proxy) {
      return {
        ...axiosConfig,
        proxy,
      };
    }

    return axiosConfig;
  }

  private resolveProxyCandidates(proxyOptions?: ProxyRequestOptions): string[] {
    const configuredList = (proxyOptions?.proxyList || [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (configuredList.length > 0) {
      return configuredList;
    }

    if (proxyOptions?.proxyMode === 'auto' || this.autoProxyPool.length > 0) {
      return this.autoProxyPool;
    }

    return [];
  }

  private selectProxy(proxyList: string[], mode: Exclude<ProxyMode, 'try'>): string {
    if (mode === 'single' || mode === 'auto') {
      return proxyList[0];
    }

    if (mode === 'random') {
      const index = Math.floor(Math.random() * proxyList.length);
      return proxyList[index];
    }

    const proxy = proxyList[this.proxyRotationIndex % proxyList.length];
    this.proxyRotationIndex += 1;
    return proxy;
  }

  private parseProxyUrl(proxyUrl: string): AxiosProxyConfig {
    let parsed: URL;
    try {
      parsed = new URL(proxyUrl);
    } catch {
      throw new Error(`Invalid proxy URL: ${proxyUrl}`);
    }

    const port =
      parsed.port.length > 0
        ? Number(parsed.port)
        : parsed.protocol === 'https:'
          ? 443
          : 80;

    if (!Number.isFinite(port)) {
      throw new Error(`Invalid proxy port in URL: ${proxyUrl}`);
    }

    const auth =
      parsed.username.length > 0
        ? {
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
          }
        : undefined;

    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port,
      auth,
    };
  }

  private resolveRetryPolicy(override?: RetryPolicy): Required<RetryPolicy> {
    return {
      maxRetries: override?.maxRetries ?? this.defaultRetryPolicy.maxRetries,
      baseDelayMs: override?.baseDelayMs ?? this.defaultRetryPolicy.baseDelayMs,
      maxDelayMs: override?.maxDelayMs ?? this.defaultRetryPolicy.maxDelayMs,
    };
  }

  private isRetryableError(error: unknown): boolean {
    const axiosError = error as AxiosError;

    if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
      return true;
    }

    if (axiosError.code === 'ECONNABORTED') {
      return true;
    }

    const status = axiosError.response?.status;
    if (status === undefined) {
      return false;
    }

    return status >= 500 || status === 429;
  }

  private computeRetryDelay(
    error: unknown,
    retryPolicy: Required<RetryPolicy>,
    attempt: number,
  ): number {
    const axiosError = error as AxiosError;
    const retryAfter = axiosError.response?.headers?.['retry-after'];
    if (typeof retryAfter === 'string') {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return seconds * 1000;
      }
    }

    const exponential = retryPolicy.baseDelayMs * Math.pow(2, attempt - 1);
    const capped = Math.min(exponential, retryPolicy.maxDelayMs);
    const jitter = Math.floor(Math.random() * 250);
    return capped + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
