import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AiModule } from './modules/ai/ai.module';
import { HealthModule } from './modules/health/health.module';
import { BrevoModule } from './modules/brevo/brevo.module';
import { QueueModule } from './modules/queue/queue.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { SeedModule } from './modules/seed/seed.module';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import configuration from './config/configuration';
import { getDatabaseSslOption } from './config/database-url';
import { validate } from './config/validate-env';
import { MarketIngestionModule } from './modules/market-ingestion/market-ingestion.module';
import { MarketReferenceModule } from './modules/market-reference/market-reference.module';
import { MarketPricingModule } from './modules/market-pricing/market-pricing.module';
import { CompanyIntelModule } from './modules/company-intel/company-intel.module';
import { DataHubModule } from './modules/data-hub/data-hub.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('app.nodeEnv');
        const databaseUrl = configService.get<string>('database.url');
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is required');
        }
        const ssl = getDatabaseSslOption(databaseUrl);
        return {
          type: 'postgres' as const,
          url: databaseUrl,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: nodeEnv !== 'production',
          logging: nodeEnv === 'development',
          ...(ssl !== undefined && { ssl }),
        };
      },
    }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp:
        process.env.NODE_ENV === 'production'
          ? {}
          : {
              transport: {
                target: 'pino-pretty',
                options: { singleLine: true },
              },
            },
    }),
    QueueModule,
    BrevoModule,
    ReportingModule,
    AiModule,
    HealthModule,
    QuotesModule,
    ProvidersModule,
    IngestionModule,
    SeedModule,
    MarketReferenceModule,
    MarketPricingModule,
    CompanyIntelModule,
    MarketIngestionModule,
    DataHubModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
