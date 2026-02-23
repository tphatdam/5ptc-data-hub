import { Module } from '@nestjs/common';
import { DataHubModule } from '../data-hub/data-hub.module';
import { ApiProvidersModule } from '../api-compatibility/providers/api-providers.module';
import { SStockApiProvider } from '../api-compatibility/providers/sstock-api.provider';
import { StockApiController } from './stock-api.controller';
import { StockApiService } from './stock-api.service';
import { SStockProxyController } from './sstock-proxy.controller';
import { SStockProxyService } from './sstock-proxy.service';
import { STOCK_PROVIDER } from './stock-api.service';

@Module({
  imports: [DataHubModule, ApiProvidersModule],
  controllers: [StockApiController, SStockProxyController],
  providers: [
    StockApiService,
    SStockProxyService,
    {
      provide: STOCK_PROVIDER,
      useExisting: SStockApiProvider,
    },
  ],
  exports: [DataHubModule, SStockProxyService],
})
export class MarketCompanyModule {}
