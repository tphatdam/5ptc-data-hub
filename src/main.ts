import './strapi-shim';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { getReplitDomain } from './utils/file.utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const logger = new Logger('Bootstrap');

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.is('json')) {
      req.body = req.body || {};
    }
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('PDF Generator API')
    .setVersion('1.0.0')
    .setDescription(
      'A NestJS + Puppeteer service that generates PDF files from JSON data and creates Vietnamese stock analysis reports',
    )
    .addServer(getReplitDomain(), 'Development server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

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
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
