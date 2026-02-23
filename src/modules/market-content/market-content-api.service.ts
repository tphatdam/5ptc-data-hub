import { Injectable, Inject } from '@nestjs/common';
import { IStockProxyProvider } from '../api-compatibility/providers/interfaces';

export const CONTENT_PROVIDER = 'CONTENT_PROVIDER';

@Injectable()
export class MarketContentApiService {
  constructor(
    @Inject(CONTENT_PROVIDER)
    private readonly provider: IStockProxyProvider,
  ) {}

  async getArticles(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/articles', query as Record<string, string>);
  }

  async getArticleById(identifier: string): Promise<unknown> {
    return this.provider.get(`/api/articles/${encodeURIComponent(identifier)}`);
  }

  async searchArticles(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/articles/search', query as Record<string, string>);
  }

  async getRelatedArticles(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/articles/related', query as Record<string, string>);
  }

  async getArticleNext(slug: string): Promise<unknown> {
    return this.provider.get(`/api/article/${encodeURIComponent(slug)}/next`);
  }

  async getArticleEnrichedSymbols(slug: string): Promise<unknown> {
    return this.provider.get(`/api/article/${encodeURIComponent(slug)}/enriched-symbols`);
  }

  async getNewsExpert(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/news/expert', query as Record<string, string>);
  }

  async getNewsArticles(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/news/articles', query as Record<string, string>);
  }

  async getNewsSentiment(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/news/sentiment', query as Record<string, string>);
  }

  async getComments(slug: string): Promise<unknown> {
    return this.provider.get(`/api/comments/article/${encodeURIComponent(slug)}`);
  }

  async createComment(slug: string, body: unknown): Promise<unknown> {
    return this.provider.post(`/api/comments/article/${encodeURIComponent(slug)}`, body);
  }

  async getCategories(): Promise<unknown> {
    return this.provider.get('/api/categories');
  }

  async getCategoryById(id: string): Promise<unknown> {
    return this.provider.get(`/api/categories/${encodeURIComponent(id)}`);
  }

  async getFilters(): Promise<unknown> {
    return this.provider.get('/api/filters');
  }

  async getTickers(): Promise<unknown> {
    return this.provider.get('/api/tickers');
  }

  async getSeo(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/seo', query as Record<string, string>);
  }

  async putSeo(body: unknown): Promise<unknown> {
    return this.provider.post('/api/seo', body);
  }
}
