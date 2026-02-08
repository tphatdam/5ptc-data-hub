import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;
      strapi.log.info(
        `[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} - ${responseTime}ms`,
      );
    });

    next();
  }
}
