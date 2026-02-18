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
  await app.listen(port, '0.0.0.0');

  logger.log(`PDF Generator service running on port ${port}`);
  logger.log(`Swagger documentation available at ${getReplitDomain()}/api-docs`);
  logger.log('Server ready - browser will initialize on first PDF request');
}

bootstrap();
