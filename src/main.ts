import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiLoggingInterceptor } from './common/interceptors/api-logging.interceptor';
import { StartupSeedService } from './modules/data-hub/services/startup-seed.service';
import { getReplitDomain } from './utils/file.utils';

function runSeedOnStartup(app: INestApplication, logger: Logger): void {
  const configService = app.get(ConfigService);
  const runOnStart = configService.get<boolean>('seed.runOnStart');
  if (runOnStart === false) {
    logger.log('Startup seed skipped (SEED_ON_STARTUP=false)');
    return;
  }

  let startupSeedService: StartupSeedService;
  try {
    startupSeedService = app.get(StartupSeedService, { strict: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Startup seed unavailable, skipping: ${message}`);
    return;
  }

  logger.log('Startup seed triggered');
  void startupSeedService
    .runOnStartup()
    .then(() => {
      logger.log('Startup seed completed');
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Startup seed failed (continuing): ${message}`);
    });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: ['log', 'error', 'warn', 'debug'],
  });
  app.useLogger(app.get(PinoLogger));

  const logger = new Logger('Bootstrap');

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiLoggingInterceptor());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.is('json')) {
      req.body = req.body || {};
    }
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('5PTC Data Hub API')
    .setVersion('1.0.0')
    .setDescription(
      'Data Hub API: Vietnamese stock analysis, PDF reports, and API compatibility layer for frontend. All /api/* routes require header x-api-key (INTERNAL_API_KEY). Public: GET /health, GET /api/health.',
    )
    .addServer(getReplitDomain(), 'Development server')
    // Add bearer token authentication for Swagger
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
        description: 'Enter JWT token in format: Bearer <token>',
      },
      'bearer', // This is the security name that can be referenced later
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'API key for /api/* routes (INTERNAL_API_KEY). Required for all endpoints except /health and /api/health.',
      },
      'apiKey',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 5000;
  const host = '0.0.0.0';
  // Run init() (registers routes, lifecycle hooks). If it hangs (e.g. onApplicationBootstrap in a provider),
  // proceed after timeout and bind the server so the app still starts.
  const initPromise = (app as { isInitialized?: boolean }).isInitialized
    ? Promise.resolve()
    : (app as { init: () => Promise<unknown> }).init();
  const INIT_TIMEOUT_MS = 10_000;
  await Promise.race([
    initPromise,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error(`init() did not complete within ${INIT_TIMEOUT_MS}ms`)), INIT_TIMEOUT_MS),
    ),
  ]).catch((err) => {
    logger.warn(`Init timeout or error (continuing to listen): ${err instanceof Error ? err.message : String(err)}`);
  });

  const httpServer = app.getHttpServer();
  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      httpServer.removeListener('listening', onListen);
      reject(err);
    };
    const onListen = () => {
      httpServer.removeListener('error', onError);
      resolve();
    };
    httpServer.once('error', onError);
    httpServer.once('listening', onListen);
    httpServer.listen(Number(port), host);
  });

  logger.log(`5PTC Data hub service running on port ${port}`);
  logger.log(`Swagger documentation available at ${getReplitDomain()}/api-docs`);
  logger.log('Server ready - browser will initialize on first PDF request');
  runSeedOnStartup(app, logger);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
