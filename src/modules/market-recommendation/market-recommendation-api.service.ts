import { Injectable, Inject } from '@nestjs/common';
import { IStockProxyProvider } from '../api-compatibility/providers/interfaces';

export const RECOMMENDATION_PROVIDER = 'RECOMMENDATION_PROVIDER';

@Injectable()
export class MarketRecommendationApiService {
  constructor(
    @Inject(RECOMMENDATION_PROVIDER)
    private readonly provider: IStockProxyProvider,
  ) {}

  async getRecommendations(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/recommendations', query);
  }

  async getRecommendationsExpert(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/recommendations/expert', query);
  }

  async postExpertRecommendations(body: unknown): Promise<unknown> {
    return this.provider.post('/api/expert-recommendations', body);
  }

  async getInvestRecommendations(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/invest-recommendations', query);
  }

  async getMeWatchlist(): Promise<unknown> {
    return this.provider.get('/api/me/watchlist');
  }

  async getWatchlists(): Promise<unknown> {
    return this.provider.get('/api/watchlists');
  }

  async getWatchlistsLight(): Promise<unknown> {
    return this.provider.get('/api/watchlists/light');
  }

  async getWatchlistsCheck(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/watchlists/check', query);
  }

  async getWatchlistsCheckMany(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/watchlists/check-many', query);
  }

  async postWatchlistAdd(id: string, body: unknown): Promise<unknown> {
    return this.provider.post(`/api/watchlists/${encodeURIComponent(id)}/add`, body);
  }

  async deleteWatchlistRemove(id: string): Promise<unknown> {
    if (this.provider.delete) {
      return this.provider.delete(`/api/watchlists/${encodeURIComponent(id)}/remove`);
    }
    return this.provider.post(`/api/watchlists/${encodeURIComponent(id)}/remove`, {});
  }

  async postWatchlistDefaultAdd(body: unknown): Promise<unknown> {
    return this.provider.post('/api/watchlists/default/add', body);
  }

  async deleteWatchlistDefaultRemove(): Promise<unknown> {
    if (this.provider.delete) {
      return this.provider.delete('/api/watchlists/default/remove');
    }
    return this.provider.post('/api/watchlists/default/remove', {});
  }

  async getAlerts(): Promise<unknown> {
    return this.provider.get('/api/alerts');
  }

  async postAlertsStocks(body: unknown): Promise<unknown> {
    return this.provider.post('/api/alerts/stocks', body);
  }

  async postAlertsBatch(body: unknown): Promise<unknown> {
    return this.provider.post('/api/alerts/batch', body);
  }

  async postAlertStock(stockCode: string, body?: unknown): Promise<unknown> {
    return this.provider.post(`/api/alerts/${encodeURIComponent(stockCode)}`, body ?? {});
  }

  async deleteAlertStock(stockCode: string): Promise<unknown> {
    if (this.provider.delete) {
      return this.provider.delete(`/api/alerts/${encodeURIComponent(stockCode)}`);
    }
    return this.provider.post(`/api/alerts/${encodeURIComponent(stockCode)}/delete`, {});
  }

  async getNotifications(): Promise<unknown> {
    return this.provider.get('/api/notifications');
  }

  async getNotificationsUnreadCount(): Promise<unknown> {
    return this.provider.get('/api/notifications/unread-count');
  }

  async postNotificationRead(id: string): Promise<unknown> {
    return this.provider.post(`/api/notifications/${encodeURIComponent(id)}/read`, {});
  }

  async postNotificationsReadAll(): Promise<unknown> {
    return this.provider.post('/api/notifications/read-all', {});
  }
}
