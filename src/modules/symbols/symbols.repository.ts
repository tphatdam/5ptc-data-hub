import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Symbol } from '../../db/entities/symbol.entity';

export interface UpsertSymbolDto {
  symbol: string;
  exchange?: string;
  name?: string;
  industryCode?: string;
  status?: string;
}

@Injectable()
export class SymbolsRepository {
  private readonly logger = new Logger(SymbolsRepository.name);

  constructor(
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
  ) {}

  /**
   * Upsert a symbol by symbol code.
   * Uses TypeORM's save() method which handles conflicts based on unique constraints.
   */
  async upsertSymbol(data: UpsertSymbolDto): Promise<Symbol> {
    try {
      // Check if symbol exists
      const existing = await this.symbolRepository.findOne({
        where: { symbol: data.symbol },
      });

      if (existing) {
        // Update existing symbol
        const updated = this.symbolRepository.merge(existing, {
          exchange: data.exchange ?? existing.exchange,
          name: data.name ?? existing.name,
          industryCode: data.industryCode ?? existing.industryCode,
          status: data.status ?? existing.status,
        });
        return await this.symbolRepository.save(updated);
      } else {
        // Create new symbol
        const newSymbol = this.symbolRepository.create({
          symbol: data.symbol,
          exchange: data.exchange,
          name: data.name,
          industryCode: data.industryCode,
          status: data.status || 'ACTIVE',
        });
        return await this.symbolRepository.save(newSymbol);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to upsert symbol ${data.symbol}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Find a symbol by its symbol code.
   */
  async findBySymbol(symbol: string): Promise<Symbol | null> {
    try {
      return await this.symbolRepository.findOne({
        where: { symbol },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to find symbol ${symbol}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Search symbols with case-insensitive pattern matching and pagination.
   * Uses ILIKE for case-insensitive search.
   */
  async searchSymbols(
    search: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Symbol[];
    total: number;
  }> {
    try {
      const skip = (page - 1) * limit;

      // Build where clause for search
      const whereClause = search
        ? [
            { symbol: ILike(`%${search}%`) },
            { name: ILike(`%${search}%`) },
            { exchange: ILike(`%${search}%`) },
          ]
        : {};

      const [data, total] = await this.symbolRepository.findAndCount({
        where: whereClause,
        skip,
        take: limit,
        order: { symbol: 'ASC' },
      });

      return { data, total };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to search symbols with query "${search}": ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Get all active symbols.
   * Filters by status='ACTIVE'.
   */
  async getAllActive(): Promise<Symbol[]> {
    try {
      return await this.symbolRepository.find({
        where: { status: 'ACTIVE' },
        order: { symbol: 'ASC' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to get all active symbols: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }
}
