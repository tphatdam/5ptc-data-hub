import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

@Injectable()
export class ApiLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
    req.requestId = requestId;
    req.startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - (req.startTime ?? 0);
          const res = context.switchToHttp().getResponse();
          this.logger.log(
            `requestId=${requestId} method=${req.method} path=${req.path} status=${res.statusCode} duration=${duration}ms`,
          );
        },
        error: () => {
          const duration = Date.now() - (req.startTime ?? 0);
          this.logger.warn(
            `requestId=${requestId} method=${req.method} path=${req.path} duration=${duration}ms error`,
          );
        },
      }),
    );
  }
}
