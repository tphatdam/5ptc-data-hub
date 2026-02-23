import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AgentDataService } from './agent-data.service';

@ApiTags('Agent Data')
@ApiSecurity('apiKey')
@Controller('api/agent')
export class AgentDataController {
  constructor(private readonly service: AgentDataService) {}

  @Get('quote/:symbol')
  @ApiOperation({ summary: 'Get quote for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiResponse({ status: 200, description: 'Quote with meta' })
  getQuote(@Param('symbol') symbol: string) {
    return this.service.getQuote(symbol);
  }

  @Get('history/:symbol')
  @ApiOperation({ summary: 'Get OHLCV history for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'interval', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  getHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('interval') interval?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getHistory(
      symbol,
      from ?? '',
      to ?? '',
      interval ?? '1d',
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get('fundamentals/:symbol')
  @ApiOperation({ summary: 'Get fundamentals for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiQuery({ name: 'asOf', required: false })
  @ApiResponse({ status: 200 })
  getFundamentals(@Param('symbol') symbol: string, @Query('asOf') asOf?: string) {
    return this.service.getFundamentals(symbol, asOf);
  }

  @Get('statements/:symbol')
  @ApiOperation({ summary: 'Get financial statements for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiQuery({ name: 'type', required: true, enum: ['balance_sheet', 'income_statement', 'cashflow'] })
  @ApiQuery({ name: 'frequency', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  getStatements(
    @Param('symbol') symbol: string,
    @Query('type') type: 'balance_sheet' | 'income_statement' | 'cashflow',
    @Query('frequency') frequency?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getStatements(
      symbol,
      type,
      frequency ?? 'quarterly',
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get('news/:symbol')
  @ApiOperation({ summary: 'Get news for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  getNews(
    @Param('symbol') symbol: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getNews(symbol, startDate, endDate, limit ? parseInt(limit, 10) : 50);
  }

  @Get('news/global')
  @ApiOperation({ summary: 'Get global news' })
  @ApiQuery({ name: 'currDate', required: false })
  @ApiQuery({ name: 'lookBackDays', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  getGlobalNews(
    @Query('currDate') currDate?: string,
    @Query('lookBackDays') lookBackDays?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getGlobalNews(
      currDate,
      lookBackDays ? parseInt(lookBackDays, 10) : 7,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('insider/sentiment/:symbol')
  @ApiOperation({ summary: 'Get insider sentiment for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200 })
  getInsiderSentiment(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getInsiderSentiment(symbol, from, to);
  }

  @Get('insider/transactions/:symbol')
  @ApiOperation({ summary: 'Get insider transactions for symbol' })
  @ApiParam({ name: 'symbol' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  getInsiderTransactions(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getInsiderTransactions(
      symbol,
      from,
      to,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get('index-summary/:symbol')
  @ApiOperation({ summary: 'Get index summary (VNINDEX, HNXINDEX, UPCOM alias to UPCOMINDEX)' })
  @ApiParam({ name: 'symbol' })
  @ApiResponse({ status: 200 })
  getIndexSummary(@Param('symbol') symbol: string) {
    return this.service.getIndexSummary(symbol);
  }
}
