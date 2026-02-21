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
import { LoggerMiddleware } from './middlewares/logger.middleware';
import configuration from './config/configuration';
import { getDatabaseSslOption } from './config/database-url';
import { validate } from './config/validate-env';
import { ExchangeProviderModule } from './modules/exchange-provider/exchange-provider.module';

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
          url: databaseUrl,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: nodeEnv === 'development',
        };

        if (databaseUrl) {
          const ssl = getDatabaseSslOption(databaseUrl);
          return {
            ...baseConfig,
            ...(ssl !== undefined && { ssl }),
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
    ReportingModule,
    AiModule,
    HealthModule,
    ExchangeProviderModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
