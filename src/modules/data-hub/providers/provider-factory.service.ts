import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource as DataSourceEntity } from '../entities';
import { TcbsProvider } from './tcbs.provider';
import {
  AnyDataProvider,
  MarketDataProvider,
  FundamentalsProvider,
  GoldPriceProvider,
  NewsProvider,
  SymbolListProvider,
  CompanyIntelProvider,
  ProviderCapability,
  RegisteredProvider,
} from './interfaces';
import { ProviderRegistryService } from './provider-registry.service';
import { SimplizeProvider } from './simplize.provider';
import { SStockProvider } from './sstock.provider';

export type ProviderEntry<TProvider extends AnyDataProvider> = RegisteredProvider<TProvider>;

@Injectable()
export class ProviderFactoryService {
  private readonly logger = new Logger(ProviderFactoryService.name);
  private readonly defaultProviderChain: string[];

  constructor(
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepository: Repository<DataSourceEntity>,
    private readonly configService: ConfigService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly tcbsProvider: TcbsProvider,
    private readonly simplizeProvider: SimplizeProvider,
    private readonly sstockProvider: SStockProvider,
  ) {
    this.defaultProviderChain = this.loadDefaultProviderChain();
    this.registerProvider('TCBS_API', this.tcbsProvider);
    this.registerProvider('SIMPLIZE_API', this.simplizeProvider);
    this.registerProvider('SSTOCK_API', this.sstockProvider);
  }

  private loadDefaultProviderChain(): string[] {
    const configured =
      this.configService.get<string>('dataHub.providerFallbackChain') ||
      'TCBS_API,SSTOCK_API,SIMPLIZE_API';

    return configured
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private registerProvider(code: string, provider: AnyDataProvider): void {
    const capabilities: ProviderCapability[] = [];

    if ('fetchIntradayCandles15m' in provider) {
      capabilities.push('market');
    }
    if ('fetchSnapshots' in provider) {
      capabilities.push('fundamentals');
    }
    if ('fetchGold' in provider) {
      capabilities.push('gold');
    }
    if ('fetchLatest' in provider) {
      capabilities.push('news');
    }
    if ('fetchSymbolList' in provider) {
      capabilities.push('symbol-list');
    }
    if ('fetchForeignTradingDaily' in provider || 'fetchInsiderEvents' in provider) {
      capabilities.push('company-intel');
    }

    if (capabilities.length === 0) {
      this.logger.warn(`Skipping provider ${code}: no recognized capabilities`);
      return;
    }

    this.providerRegistry.register({ code, provider, capabilities });
  }

  async getMarketProviderEntries(
    preferredCodes?: string[],
  ): Promise<Array<ProviderEntry<MarketDataProvider>>> {
    const entries = this.providerRegistry.listByCapability<MarketDataProvider>('market');
    return this.orderProviders(entries, preferredCodes);
  }

  async getFundamentalsProviderEntries(
    preferredCodes?: string[],
  ): Promise<Array<ProviderEntry<FundamentalsProvider>>> {
    const entries =
      this.providerRegistry.listByCapability<FundamentalsProvider>('fundamentals');
    return this.orderProviders(entries, preferredCodes);
  }

  async getGoldProviderEntries(
    preferredCodes?: string[],
  ): Promise<Array<ProviderEntry<GoldPriceProvider>>> {
    const entries = this.providerRegistry.listByCapability<GoldPriceProvider>('gold');
    return this.orderProviders(entries, preferredCodes);
  }

  async getNewsProviderEntries(
    preferredCodes?: string[],
  ): Promise<Array<ProviderEntry<NewsProvider>>> {
    const entries = this.providerRegistry.listByCapability<NewsProvider>('news');
    return this.orderProviders(entries, preferredCodes);
  }

  async getSymbolListProviderEntries(
    preferredCodes?: string[],
  ): Promise<Array<ProviderEntry<SymbolListProvider>>> {
    const entries =
      this.providerRegistry.listByCapability<SymbolListProvider>('symbol-list');
    return this.orderProviders(entries, preferredCodes);
  }

  async getCompanyIntelProviderEntries(
    preferredCodes?: string[],
  ): Promise<Array<ProviderEntry<CompanyIntelProvider>>> {
    const entries =
      this.providerRegistry.listByCapability<CompanyIntelProvider>('company-intel');
    return this.orderProviders(entries, preferredCodes);
  }

  async getMarketProvider(code?: string): Promise<MarketDataProvider | null> {
    if (code) {
      return (
        this.providerRegistry.getByCode<MarketDataProvider>('market', code)?.provider || null
      );
    }

    const source = await this.dataSourceRepository.findOne({
      where: { type: 'MARKET' as any, isActive: true },
    });

    if (source) {
      return (
        this.providerRegistry.getByCode<MarketDataProvider>('market', source.code)
          ?.provider || null
      );
    }

    const entries = await this.getMarketProviderEntries();
    return entries[0]?.provider || null;
  }

  async getFundamentalsProvider(code?: string): Promise<FundamentalsProvider | null> {
    if (code) {
      return (
        this.providerRegistry.getByCode<FundamentalsProvider>('fundamentals', code)
          ?.provider || null
      );
    }

    const source = await this.dataSourceRepository.findOne({
      where: { type: 'MARKET' as any, isActive: true },
    });

    if (source) {
      return (
        this.providerRegistry.getByCode<FundamentalsProvider>('fundamentals', source.code)
          ?.provider || null
      );
    }

    const entries = await this.getFundamentalsProviderEntries();
    return entries[0]?.provider || null;
  }

  async getGoldProvider(code?: string): Promise<GoldPriceProvider | null> {
    if (code) {
      return this.providerRegistry.getByCode<GoldPriceProvider>('gold', code)?.provider || null;
    }
    const entries = await this.getGoldProviderEntries();
    return entries[0]?.provider || null;
  }

  async getNewsProvider(code?: string): Promise<NewsProvider | null> {
    if (code) {
      return this.providerRegistry.getByCode<NewsProvider>('news', code)?.provider || null;
    }
    const entries = await this.getNewsProviderEntries();
    return entries[0]?.provider || null;
  }

  async getSymbolListProvider(code?: string): Promise<SymbolListProvider | null> {
    if (code) {
      return (
        this.providerRegistry.getByCode<SymbolListProvider>('symbol-list', code)
          ?.provider || null
      );
    }
    const entries = await this.getSymbolListProviderEntries();
    return entries[0]?.provider || null;
  }

  async getCompanyIntelProvider(code?: string): Promise<CompanyIntelProvider | null> {
    if (code) {
      return (
        this.providerRegistry.getByCode<CompanyIntelProvider>('company-intel', code)
          ?.provider || null
      );
    }
    const entries = await this.getCompanyIntelProviderEntries();
    return entries[0]?.provider || null;
  }

  async getDataSourceByCode(code: string): Promise<DataSourceEntity | null> {
    return this.dataSourceRepository.findOne({ where: { code } });
  }

  private orderProviders<TProvider extends AnyDataProvider>(
    entries: Array<ProviderEntry<TProvider>>,
    preferredCodes?: string[],
  ): Array<ProviderEntry<TProvider>> {
    if (entries.length <= 1) {
      return entries;
    }

    const order = this.mergeProviderOrder(preferredCodes);
    if (order.length === 0) {
      return entries;
    }

    const orderIndex = new Map(order.map((code, index) => [code, index]));
    return [...entries].sort((left, right) => {
      const leftOrder = orderIndex.get(left.code) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderIndex.get(right.code) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
  }

  private mergeProviderOrder(preferredCodes?: string[]): string[] {
    const merged = [...(preferredCodes || []), ...this.defaultProviderChain];
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const code of merged) {
      if (!code || seen.has(code)) {
        continue;
      }
      seen.add(code);
      ordered.push(code);
    }

    return ordered;
  }
}
