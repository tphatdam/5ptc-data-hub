import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { HttpClientService } from './http-client.service';
import { VciProvider } from './vci/vci.provider';
import { MarketProvider } from './market-provider.interface';

/**
 * ProvidersModule provides HTTP client services and market data provider abstractions
 * 
 * This module exports:
 * - HttpClientService: Shared HTTP client with retry logic and timeout handling
 * - VciProvider: VCI market data provider implementation
 * - MarketProvider interface: Contract for market data providers
 * - DTOs: SymbolDTO, DailyBarDTO, IntradayTickDTO for data transfer
 */
@Module({
  imports: [
    HttpModule, // @nestjs/axios HttpModule
    ConfigModule, // For accessing configuration
  ],
  providers: [
    HttpClientService,
    VciProvider,
    // Provide VciProvider as the MarketProvider implementation
    {
      provide: 'MarketProvider',
      useExisting: VciProvider,
    },
  ],
  exports: [HttpClientService, VciProvider, 'MarketProvider'],
})
export class ProvidersModule {}
