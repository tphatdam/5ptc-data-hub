import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Symbol } from '../db/entities/symbol.entity';
import { SymbolsRepository } from './symbols.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Symbol])],
  providers: [SymbolsRepository],
  exports: [SymbolsRepository, TypeOrmModule],
})
export class SymbolsModule {}
