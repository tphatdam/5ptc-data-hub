import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { MarketReportingApiService } from './market-reporting-api.service';

@ApiTags('Onboarding / Payment / Report')
@ApiSecurity('apiKey')
@Controller('api')
export class MarketReportingApiController {
  constructor(private readonly service: MarketReportingApiService) {}

  @Post('onboarding/submit')
  @ApiOperation({ summary: 'Submit onboarding' })
  @ApiResponse({ status: 200 })
  postOnboardingSubmit(@Body() body: unknown) {
    return this.service.postOnboardingSubmit(body ?? {});
  }

  @Post('onboarding/mark-incomplete')
  @ApiOperation({ summary: 'Mark onboarding incomplete' })
  @ApiResponse({ status: 200 })
  postOnboardingMarkIncomplete(@Body() body: unknown) {
    return this.service.postOnboardingMarkIncomplete(body);
  }

  @Post('onboarding/watchlist')
  @ApiOperation({ summary: 'Onboarding watchlist' })
  @ApiResponse({ status: 200 })
  postOnboardingWatchlist(@Body() body: unknown) {
    return this.service.postOnboardingWatchlist(body ?? {});
  }

  @Get('onboarding/status')
  @ApiOperation({ summary: 'Onboarding status' })
  @ApiResponse({ status: 200 })
  getOnboardingStatus() {
    return this.service.getOnboardingStatus();
  }

  @Post('payment/generate-qr')
  @ApiOperation({ summary: 'Generate payment QR' })
  @ApiResponse({ status: 200 })
  postPaymentGenerateQr(@Body() body: unknown) {
    return this.service.postPaymentGenerateQr(body ?? {});
  }

  @Get('payment/check-success/:txnRef')
  @ApiOperation({ summary: 'Check payment success' })
  @ApiParam({ name: 'txnRef' })
  @ApiResponse({ status: 200 })
  getPaymentCheckSuccess(@Param('txnRef') txnRef: string) {
    return this.service.getPaymentCheckSuccess(txnRef);
  }

  @Post('payment/webhook')
  @ApiOperation({ summary: 'Payment webhook' })
  @ApiResponse({ status: 200 })
  postPaymentWebhook(@Body() body: unknown) {
    return this.service.postPaymentWebhook(body ?? {});
  }

  @Get('daily-report/:symbol/:email')
  @ApiOperation({ summary: 'Daily report by symbol and email' })
  @ApiParam({ name: 'symbol' })
  @ApiParam({ name: 'email' })
  @ApiResponse({ status: 200 })
  getDailyReport(@Param('symbol') symbol: string, @Param('email') email: string) {
    return this.service.getDailyReport(symbol, email);
  }

  @Post('get-stock-report/:symbol')
  @ApiOperation({ summary: 'Get stock report' })
  @ApiParam({ name: 'symbol' })
  @ApiResponse({ status: 200 })
  postGetStockReport(@Param('symbol') symbol: string, @Body() body: unknown) {
    return this.service.postGetStockReport(symbol, body);
  }

  @Post('mark-download/:symbol')
  @ApiOperation({ summary: 'Mark download' })
  @ApiParam({ name: 'symbol' })
  @ApiResponse({ status: 200 })
  postMarkDownload(@Param('symbol') symbol: string, @Body() body: unknown) {
    return this.service.postMarkDownload(symbol, body);
  }
}
