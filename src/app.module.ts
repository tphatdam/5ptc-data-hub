import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { PdfModule } from './pdf/pdf.module';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';
import { BrevoModule } from './brevo/brevo.module';
import { QueueModule } from './queue/queue.module';
import { DailyStockReportModule } from './daily-stock-report/daily-stock-report.module';
import { QuotesModule } from './quotes/quotes.module';
import { ProvidersModule } from './providers/providers.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { SeedModule } from './seed/seed.module';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import configuration from './config/configuration';
import { validate } from './config/validate-env';
import { MarketIngestionModule } from './modules/market-ingestion/market-ingestion.module';
import { MarketReferenceModule } from './modules/market-reference/market-reference.module';
import { MarketPricingModule } from './modules/market-pricing/market-pricing.module';
import { CompanyIntelModule } from './modules/company-intel/company-intel.module';

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

        const baseConfig = {
          type: 'postgres' as const,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: nodeEnv !== 'production',
          logging: nodeEnv === 'development',
        };

        if (databaseUrl) {
          return {
            ...baseConfig,
            url: databaseUrl,
          };
        }

        return {
          ...baseConfig,
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.database'),
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
    PdfModule,
    AiModule,
    HealthModule,
    DailyStockReportModule,
    QuotesModule,
    ProvidersModule,
    IngestionModule,
    SeedModule,
    MarketReferenceModule,
    MarketPricingModule,
    CompanyIntelModule,
    MarketIngestionModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
