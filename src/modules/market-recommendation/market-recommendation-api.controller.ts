import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { MarketRecommendationApiService } from './market-recommendation-api.service';

@ApiTags('Recommendation / Portfolio')
@ApiSecurity('apiKey')
@Controller('api')
export class MarketRecommendationApiController {
  constructor(private readonly service: MarketRecommendationApiService) {}

  @Get('recommendations')
  @ApiOperation({ summary: 'Get recommendations' })
  @ApiResponse({ status: 200 })
  getRecommendations(@Query() query: Record<string, string>) {
    return this.service.getRecommendations(query);
  }

  @Get('recommendations/expert')
  @ApiOperation({ summary: 'Expert recommendations' })
  @ApiResponse({ status: 200 })
  getRecommendationsExpert(@Query() query: Record<string, string>) {
    return this.service.getRecommendationsExpert(query);
  }

  @Post('expert-recommendations')
  @ApiOperation({ summary: 'Post expert recommendations' })
  @ApiResponse({ status: 200 })
  postExpertRecommendations(@Body() body: unknown) {
    return this.service.postExpertRecommendations(body ?? {});
  }

  @Get('invest-recommendations')
  @ApiOperation({ summary: 'Invest recommendations' })
  @ApiResponse({ status: 200 })
  getInvestRecommendations(@Query() query: Record<string, string>) {
    return this.service.getInvestRecommendations(query);
  }

  @Get('me/watchlist')
  @ApiOperation({ summary: 'My watchlist' })
  @ApiResponse({ status: 200 })
  getMeWatchlist() {
    return this.service.getMeWatchlist();
  }

  @Get('watchlists')
  @ApiOperation({ summary: 'Get watchlists' })
  @ApiResponse({ status: 200 })
  getWatchlists() {
    return this.service.getWatchlists();
  }

  @Get('watchlists/light')
  @ApiOperation({ summary: 'Watchlists light' })
  @ApiResponse({ status: 200 })
  getWatchlistsLight() {
    return this.service.getWatchlistsLight();
  }

  @Get('watchlists/check')
  @ApiOperation({ summary: 'Watchlist check' })
  @ApiResponse({ status: 200 })
  getWatchlistsCheck(@Query() query: Record<string, string>) {
    return this.service.getWatchlistsCheck(query);
  }

  @Get('watchlists/check-many')
  @ApiOperation({ summary: 'Watchlist check many' })
  @ApiResponse({ status: 200 })
  getWatchlistsCheckMany(@Query() query: Record<string, string>) {
    return this.service.getWatchlistsCheckMany(query);
  }

  @Post('watchlists/:id/add')
  @ApiOperation({ summary: 'Add to watchlist' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  postWatchlistAdd(@Param('id') id: string, @Body() body: unknown) {
    return this.service.postWatchlistAdd(id, body ?? {});
  }

  @Delete('watchlists/:id/remove')
  @ApiOperation({ summary: 'Remove from watchlist' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  deleteWatchlistRemove(@Param('id') id: string) {
    return this.service.deleteWatchlistRemove(id);
  }

  @Post('watchlists/default/add')
  @ApiOperation({ summary: 'Add to default watchlist' })
  @ApiResponse({ status: 200 })
  postWatchlistDefaultAdd(@Body() body: unknown) {
    return this.service.postWatchlistDefaultAdd(body ?? {});
  }

  @Delete('watchlists/default/remove')
  @ApiOperation({ summary: 'Remove from default watchlist' })
  @ApiResponse({ status: 200 })
  deleteWatchlistDefaultRemove() {
    return this.service.deleteWatchlistDefaultRemove();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get alerts' })
  @ApiResponse({ status: 200 })
  getAlerts() {
    return this.service.getAlerts();
  }

  @Post('alerts/stocks')
  @ApiOperation({ summary: 'Alerts stocks' })
  @ApiResponse({ status: 200 })
  postAlertsStocks(@Body() body: unknown) {
    return this.service.postAlertsStocks(body ?? {});
  }

  @Post('alerts/batch')
  @ApiOperation({ summary: 'Alerts batch' })
  @ApiResponse({ status: 200 })
  postAlertsBatch(@Body() body: unknown) {
    return this.service.postAlertsBatch(body ?? {});
  }

  @Post('alerts/:stockCode')
  @ApiOperation({ summary: 'Create alert for stock' })
  @ApiParam({ name: 'stockCode' })
  @ApiResponse({ status: 200 })
  postAlertStock(@Param('stockCode') stockCode: string, @Body() body: unknown) {
    return this.service.postAlertStock(stockCode, body);
  }

  @Delete('alerts/:stockCode')
  @ApiOperation({ summary: 'Delete alert for stock' })
  @ApiParam({ name: 'stockCode' })
  @ApiResponse({ status: 200 })
  deleteAlertStock(@Param('stockCode') stockCode: string) {
    return this.service.deleteAlertStock(stockCode);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get notifications' })
  @ApiResponse({ status: 200 })
  getNotifications() {
    return this.service.getNotifications();
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Unread count' })
  @ApiResponse({ status: 200 })
  getNotificationsUnreadCount() {
    return this.service.getNotificationsUnreadCount();
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification read' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  postNotificationRead(@Param('id') id: string) {
    return this.service.postNotificationRead(id);
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all read' })
  @ApiResponse({ status: 200 })
  postNotificationsReadAll() {
    return this.service.postNotificationsReadAll();
  }
}
