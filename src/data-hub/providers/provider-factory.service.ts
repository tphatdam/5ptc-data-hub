import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource as DataSourceEntity } from '../entities';
import { TcbsProvider } from './tcbs.provider';
import { MarketDataProvider, FundamentalsProvider, GoldPriceProvider, NewsProvider, SymbolListProvider } from './interfaces';

@Injectable()
export class ProviderFactoryService {
  private readonly logger = new Logger(ProviderFactoryService.name);
  private readonly marketProviders = new Map<string, MarketDataProvider>();
  private readonly fundamentalsProviders = new Map<string, FundamentalsProvider>();
  private readonly goldProviders = new Map<string, GoldPriceProvider>();
  private readonly newsProviders = new Map<string, NewsProvider>();
  private readonly symbolListProviders = new Map<string, SymbolListProvider>();

  constructor(
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepository: Repository<DataSourceEntity>,
    private readonly tcbsProvider: TcbsProvider,
  ) {
    this.registerProvider('TCBS_API', this.tcbsProvider);
  }

  private registerProvider(code: string, provider: any): void {
    if ('fetchIntradayCandles15m' in provider) {
      this.marketProviders.set(code, provider);
    }
    if ('fetchSnapshots' in provider) {
      this.fundamentalsProviders.set(code, provider);
    }
    if ('fetchGold' in provider) {
      this.goldProviders.set(code, provider);
    }
    if ('fetchLatest' in provider) {
      this.newsProviders.set(code, provider);
    }
    if ('fetchSymbolList' in provider) {
      this.symbolListProviders.set(code, provider);
    }
  }

  async getMarketProvider(code?: string): Promise<MarketDataProvider | null> {
    if (code) {
      return this.marketProviders.get(code) || null;
    }

    const source = await this.dataSourceRepository.findOne({
      where: { type: 'MARKET' as any, isActive: true },
    });
    
    if (source) {
      return this.marketProviders.get(source.code) || null;
    }

    return this.marketProviders.values().next().value || null;
  }

  async getFundamentalsProvider(code?: string): Promise<FundamentalsProvider | null> {
    if (code) {
      return this.fundamentalsProviders.get(code) || null;
    }

    const source = await this.dataSourceRepository.findOne({
      where: { type: 'MARKET' as any, isActive: true },
    });
    
    if (source) {
      return this.fundamentalsProviders.get(source.code) || null;
    }

    return this.fundamentalsProviders.values().next().value || null;
  }

  async getGoldProvider(code?: string): Promise<GoldPriceProvider | null> {
    if (code) {
      return this.goldProviders.get(code) || null;
    }
    return this.goldProviders.values().next().value || null;
  }

  async getNewsProvider(code?: string): Promise<NewsProvider | null> {
    if (code) {
      return this.newsProviders.get(code) || null;
    }
    return this.newsProviders.values().next().value || null;
  }

  async getSymbolListProvider(code?: string): Promise<SymbolListProvider | null> {
    if (code) {
      return this.symbolListProviders.get(code) || null;
    }
    return this.symbolListProviders.values().next().value || null;
  }

  async getDataSourceByCode(code: string): Promise<DataSourceEntity | null> {
    return this.dataSourceRepository.findOne({ where: { code } });
  }
}
