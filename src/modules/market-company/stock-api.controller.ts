import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { StockApiService } from './stock-api.service';

@ApiTags('Stock / Proxy')
@ApiSecurity('apiKey')
@Controller('api')
export class StockApiController {
  constructor(private readonly service: StockApiService) {}

  @Get('stocks')
  @ApiOperation({ summary: 'List stocks' })
  @ApiResponse({ status: 200 })
  getStocks(@Query() query: Record<string, string>) {
    return this.service.getStocks(query);
  }

  @Get('stocks/ai-signals/batch')
  @ApiOperation({ summary: 'Batch AI signals' })
  @ApiResponse({ status: 200 })
  getStocksAiSignalsBatch(@Query() query: Record<string, string>) {
    return this.service.getStocksAiSignalsBatch(query);
  }

  @Get('stocks/:symbol/ai-signal')
  @ApiOperation({ summary: 'AI signal for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiResponse({ status: 200 })
  getStockAiSignal(@Param('symbol') symbol: string) {
    return this.service.getStockAiSignal(symbol);
  }

  @Get('stock/profile/:symbol')
  @ApiOperation({ summary: 'Stock profile (cached 5m)' })
  @ApiParam({ name: 'symbol' })
  @ApiResponse({ status: 200 })
  getStockProfile(@Param('symbol') symbol: string) {
    return this.service.getStockProfile(symbol);
  }

  @Get('stock/info/:symbol')
  @ApiOperation({ summary: 'Stock info (cached 5m)' })
  @ApiParam({ name: 'symbol' })
  @ApiResponse({ status: 200 })
  getStockInfo(@Param('symbol') symbol: string) {
    return this.service.getStockInfo(symbol);
  }

  @Get('stock/price/:symbol')
  @ApiOperation({ summary: 'Stock price (cached 30s)' })
  @ApiParam({ name: 'symbol' })
  @ApiResponse({ status: 200 })
  getStockPrice(@Param('symbol') symbol: string) {
    return this.service.getStockPrice(symbol);
  }

  @Get('validate-related-stocks')
  @ApiOperation({ summary: 'Validate related stocks' })
  @ApiResponse({ status: 200 })
  validateRelatedStocks(@Query() query: Record<string, string>) {
    return this.service.validateRelatedStocks(query);
  }
}
