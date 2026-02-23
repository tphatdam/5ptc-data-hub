import { Controller, Get, Post, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { SStockProxyService } from './sstock-proxy.service';

@ApiTags('Stock / Proxy')
@ApiSecurity('apiKey')
@Controller('api')
export class SStockProxyController {
  constructor(private readonly service: SStockProxyService) {}

  @Get('sstock')
  @ApiOperation({ summary: 'SStock generic proxy (GET)' })
  @ApiQuery({ name: 'path', description: 'Upstream path e.g. /api/v1/company/all' })
  @ApiResponse({ status: 200 })
  proxyGet(@Query('path') path: string, @Req() req: Request) {
    if (!path || typeof path !== 'string') {
      return { success: false, error: 'BAD_REQUEST', message: 'Query "path" is required' };
    }
    const query = { ...req.query } as Record<string, string>;
    delete query.path;
    return this.service.proxyGet(path, Object.keys(query).length ? query : undefined);
  }

  @Post('sstock')
  @ApiOperation({ summary: 'SStock generic proxy (POST)' })
  @ApiQuery({ name: 'path', description: 'Upstream path' })
  @ApiResponse({ status: 200 })
  proxyPost(
    @Query('path') path: string,
    @Body() body: unknown,
  ) {
    if (!path || typeof path !== 'string') {
      return { success: false, error: 'BAD_REQUEST', message: 'Query "path" is required' };
    }
    return this.service.proxyPost(path, body);
  }
}
