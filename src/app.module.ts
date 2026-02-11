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
import { DataHubModule } from './data-hub/data-hub.module';
import { QuotesModule } from './quotes/quotes.module';
import { ProvidersModule } from './providers/providers.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { TriggerModule } from './trigger/trigger.module';
import { SeedModule } from './seed/seed.module';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import configuration from './config/configuration';
import { validate } from './config/validate-env';

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

        // Base configuration
        const baseConfig = {
          type: 'postgres' as const,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          // Disable synchronize for production - use migrations instead
          synchronize: nodeEnv !== 'production',
          logging: nodeEnv === 'development',
        };

        // Option 1: Use DATABASE_URL if provided
        if (databaseUrl) {
          return {
            ...baseConfig,
            url: databaseUrl,
          };
        }

        // Option 2: Use discrete connection parameters
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
    // Configure ScheduleModule for cron-based job scheduling
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
    DataHubModule,
    QuotesModule,
    ProvidersModule,
    IngestionModule,
    TriggerModule,
    SeedModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
