import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Symbol } from '../../db/entities/symbol.entity';
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
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
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
      await this.upsertSymbols(seedData.symbols, batchSize);
      this.logger.info({ symbols: seedData.symbols.length }, 'Seed completed');
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

  private async upsertSymbols(
    symbols: {
      ticker: string;
      exchangeCode: string;
      companyName?: string;
      industry?: string;
      isin?: string;
      listedAt?: Date;
    }[],
    batchSize: number,
  ): Promise<void> {
    const rows = symbols.map((s) => ({
      symbol: s.ticker,
      exchange: s.exchangeCode,
      name: s.companyName ?? undefined,
      industryCode: s.industry ?? undefined,
      status: 'ACTIVE',
    }));

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await this.symbolRepository.upsert(batch, ['symbol']);
      this.logger.info(
        { batch: Math.floor(i / batchSize) + 1, total: rows.length },
        'Seed symbols batch',
      );
    }
  }
}
