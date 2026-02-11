import { ExchangeDTO, IndexDTO, SymbolDTO } from './seed.dto';

export interface SeedData {
  exchanges: ExchangeDTO[];
  symbols: SymbolDTO[];
  indices: IndexDTO[];
}

export interface SeedSource {
  fetchAll(): Promise<SeedData>;
}
