import { Injectable, Inject } from '@nestjs/common';
import { IStockProxyProvider } from '../api-compatibility/providers/interfaces';

export const REPORTING_PROVIDER = 'REPORTING_PROVIDER';

@Injectable()
export class MarketReportingApiService {
  constructor(
    @Inject(REPORTING_PROVIDER)
    private readonly provider: IStockProxyProvider,
  ) {}

  async postOnboardingSubmit(body: unknown): Promise<unknown> {
    return this.provider.post('/api/onboarding/submit', body);
  }

  async postOnboardingMarkIncomplete(body?: unknown): Promise<unknown> {
    return this.provider.post('/api/onboarding/mark-incomplete', body ?? {});
  }

  async postOnboardingWatchlist(body: unknown): Promise<unknown> {
    return this.provider.post('/api/onboarding/watchlist', body);
  }

  async getOnboardingStatus(): Promise<unknown> {
    return this.provider.get('/api/onboarding/status');
  }

  async postPaymentGenerateQr(body: unknown): Promise<unknown> {
    return this.provider.post('/api/payment/generate-qr', body);
  }

  async getPaymentCheckSuccess(txnRef: string): Promise<unknown> {
    return this.provider.get(`/api/payment/check-success/${encodeURIComponent(txnRef)}`);
  }

  async postPaymentWebhook(body: unknown): Promise<unknown> {
    return this.provider.post('/api/payment/webhook', body);
  }

  async getDailyReport(symbol: string, email: string): Promise<unknown> {
    return this.provider.get(
      `/api/daily-report/${encodeURIComponent(symbol)}/${encodeURIComponent(email)}`,
    );
  }

  async postGetStockReport(symbol: string, body?: unknown): Promise<unknown> {
    return this.provider.post(`/api/get-stock-report/${encodeURIComponent(symbol)}`, body ?? {});
  }

  async postMarkDownload(symbol: string, body?: unknown): Promise<unknown> {
    return this.provider.post(`/api/mark-download/${encodeURIComponent(symbol)}`, body ?? {});
  }
}
