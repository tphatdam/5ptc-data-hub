import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { MarketPricingApiService } from './market-pricing-api.service';

@ApiTags('Market / Pricing')
@ApiSecurity('apiKey')
@Controller('api')
export class MarketPricingApiController {
  constructor(private readonly service: MarketPricingApiService) {}

  @Get('market')
  @ApiOperation({ summary: 'Get market data' })
  @ApiResponse({ status: 200 })
  getMarket(@Query() query: Record<string, string>) {
    return this.service.getMarket(query);
  }

  @Post('market')
  @ApiOperation({ summary: 'Post market data' })
  @ApiResponse({ status: 200 })
  postMarket(@Body() body: unknown) {
    return this.service.postMarket(body);
  }

  @Get('market/industries')
  @ApiOperation({ summary: 'Market industries' })
  @ApiResponse({ status: 200 })
  getMarketIndustries() {
    return this.service.getMarketIndustries();
  }

  @Get('market/proprietary-trading')
  @ApiOperation({ summary: 'Proprietary trading' })
  @ApiResponse({ status: 200 })
  getMarketProprietaryTrading() {
    return this.service.getMarketProprietaryTrading();
  }

  @Post('marketboard/index-quote')
  @ApiOperation({ summary: 'Index quote' })
  @ApiResponse({ status: 200 })
  postMarketboardIndexQuote(@Body() body: unknown) {
    return this.service.postMarketboardIndexQuote(body ?? {});
  }

  @Get('marketboard/overview')
  @ApiOperation({ summary: 'Marketboard overview' })
  @ApiResponse({ status: 200 })
  getMarketboardOverview() {
    return this.service.getMarketboardOverview();
  }

  @Get('gold-prices')
  @ApiOperation({ summary: 'Gold prices (cached 60s)' })
  @ApiResponse({ status: 200 })
  getGoldPrices() {
    return this.service.getGoldPrices();
  }

  @Get('exchange-rates')
  @ApiOperation({ summary: 'Exchange rates (cached 15m)' })
  @ApiResponse({ status: 200 })
  getExchangeRates() {
    return this.service.getExchangeRates();
  }

  @Get('vietstock/industries')
  @ApiOperation({ summary: 'Vietstock industries' })
  @ApiResponse({ status: 200 })
  getVietstockIndustries() {
    return this.service.getVietstockIndustries();
  }

  @Get('market-sentiment')
  @ApiOperation({ summary: 'Market sentiment (cached 30s)' })
  @ApiResponse({ status: 200 })
  getMarketSentiment() {
    return this.service.getMarketSentiment();
  }

  @Get('market-sentiment/recent')
  @ApiOperation({ summary: 'Market sentiment recent' })
  @ApiResponse({ status: 200 })
  getMarketSentimentRecent() {
    return this.service.getMarketSentimentRecent();
  }

  @Get('suggest-stock/latest')
  @ApiOperation({ summary: 'Suggest stock latest' })
  @ApiResponse({ status: 200 })
  getSuggestStockLatest() {
    return this.service.getSuggestStockLatest();
  }

  @Get('ai-top-stocks')
  @ApiOperation({ summary: 'AI top stocks' })
  @ApiResponse({ status: 200 })
  getAiTopStocks(@Query() query: Record<string, string>) {
    return this.service.getAiTopStocks(query);
  }

  @Get('top-stocks')
  @ApiOperation({ summary: 'Top stocks' })
  @ApiResponse({ status: 200 })
  getTopStocks(@Query() query: Record<string, string>) {
    return this.service.getTopStocks(query);
  }
}
