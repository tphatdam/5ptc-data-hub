import { Injectable } from '@nestjs/common';
import { SeedData, SeedSource } from './seed.source.interface';
import {
  STATIC_EXCHANGES,
  STATIC_INDICES,
  STATIC_SYMBOLS,
} from '../static/seed.static';

@Injectable()
export class StaticSeedSource implements SeedSource {
  async fetchAll(): Promise<SeedData> {
    return {
      exchanges: [...STATIC_EXCHANGES],
      symbols: [...STATIC_SYMBOLS],
      indices: [...STATIC_INDICES],
    };
  }
}
