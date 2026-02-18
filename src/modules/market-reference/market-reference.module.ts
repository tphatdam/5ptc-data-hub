import { Module } from '@nestjs/common';
import { SymbolsModule } from '../symbols/symbols.module';

@Module({
  imports: [SymbolsModule],
  exports: [SymbolsModule],
})
export class MarketReferenceModule {}
