import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Exchange, MarketIndex, Symbol } from '../data-hub/entities';
import { SeedSource } from './sources/seed.source.interface';
import { SStockSeedSource } from './sources/sstock.source';
import { StaticSeedSource } from './sources/static.source';
import type { SeedData } from './sources/seed.source.interface';

export interface SeedRunOptions {
  source?: 'sstock' | 'static';
  fallback?: boolean;
}

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Exchange)
    private readonly exchangeRepository: Repository<Exchange>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(MarketIndex)
    private readonly marketIndexRepository: Repository<MarketIndex>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly sstockSource: SStockSeedSource,
    private readonly staticSource: StaticSeedSource,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SeedService.name);
  }

  async run(options?: SeedRunOptions): Promise<void> {
    const sourceOverride = options?.source ?? this.configService.get<string>('seed.source');
    const fallbackEnabled = options?.fallback ?? this.configService.get<boolean>('seed.fallback');
    const lockKey = this.configService.get<number>('seed.advisoryLockKey') ?? 987654321;
    const batchSize = this.configService.get<number>('seed.batchSize') ?? 300;

    let seedData: SeedData;

    if (sourceOverride === 'static') {
      this.logger.info({ source: 'static' }, 'Seed source: static');
      seedData = await this.staticSource.fetchAll();
    } else {
      try {
        this.logger.info({ source: 'sstock' }, 'Seed source: sstock (trying)');
        seedData = await this.sstockSource.fetchAll();
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        this.logger.warn(
          { status, message: err?.message, redacted: true },
          'SStock fetch failed (cookie redacted)',
        );
        if (fallbackEnabled) {
          this.logger.info('Fallback to static source');
          seedData = await this.staticSource.fetchAll();
        } else {
          throw err;
        }
      }
    }

    const acquired = await this.tryAdvisoryLock(lockKey);
    if (!acquired) {
      this.logger.info('Seed already running (advisory lock held), skip');
      return;
    }

    try {
      await this.upsertExchanges(seedData.exchanges);
      const exchangeIdByCode = await this.getExchangeIdMap();
      await this.upsertSymbols(seedData.symbols, exchangeIdByCode, batchSize);
      await this.upsertIndices(seedData.indices, exchangeIdByCode);
      this.logger.info(
        {
          exchanges: seedData.exchanges.length,
          symbols: seedData.symbols.length,
          indices: seedData.indices.length,
        },
        'Seed completed',
      );
    } finally {
      await this.releaseAdvisoryLock(lockKey);
    }
  }

  private async tryAdvisoryLock(lockKey: number): Promise<boolean> {
    const result = await this.dataSource.query<{ acquired: boolean }[]>(
      'SELECT pg_try_advisory_lock($1) as acquired',
      [lockKey],
    );
    return result[0]?.acquired === true;
  }

  private async releaseAdvisoryLock(lockKey: number): Promise<void> {
    await this.dataSource.query('SELECT pg_advisory_unlock($1)', [lockKey]);
  }

  private async upsertExchanges(
    exchanges: { code: string; name: string }[],
  ): Promise<void> {
    if (exchanges.length === 0) return;
    await this.exchangeRepository.upsert(exchanges, ['code']);
    this.logger.info({ count: exchanges.length }, 'Upserted exchanges');
  }

  private async getExchangeIdMap(): Promise<Map<string, number>> {
    const list = await this.exchangeRepository.find({
      select: ['id', 'code'],
    });
    return new Map(list.map((e) => [e.code, e.id]));
  }

  private async upsertSymbols(
    symbols: { ticker: string; exchangeCode: string; companyName?: string; industry?: string; isin?: string; listedAt?: Date }[],
    exchangeIdByCode: Map<string, number>,
    batchSize: number,
  ): Promise<void> {
    const rows = symbols
      .map((s) => {
        const exchangeId = exchangeIdByCode.get(s.exchangeCode);
        if (exchangeId == null) return null;
        return {
          ticker: s.ticker,
          exchangeId,
          companyName: s.companyName ?? undefined,
          industry: s.industry ?? undefined,
          isin: s.isin ?? undefined,
          isActive: true,
          listedAt: s.listedAt ?? undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await this.symbolRepository.upsert(batch, ['ticker']);
      this.logger.info(
        { batch: Math.floor(i / batchSize) + 1, total: rows.length },
        'Seed symbols batch',
      );
    }
  }

  private async upsertIndices(
    indices: { code: string; name: string; exchangeCode?: string }[],
    exchangeIdByCode: Map<string, number>,
  ): Promise<void> {
    if (indices.length === 0) return;
    const rows = indices.map((idx) => ({
      code: idx.code,
      name: idx.name,
      exchangeId: idx.exchangeCode
        ? exchangeIdByCode.get(idx.exchangeCode) ?? undefined
        : undefined,
    }));
    await this.marketIndexRepository.upsert(rows, ['code']);
    this.logger.info({ count: indices.length }, 'Upserted indices');
  }
}
