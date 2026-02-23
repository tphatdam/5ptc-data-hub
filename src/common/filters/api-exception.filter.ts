import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Request } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const path = (request.path || request.url || '').split('?')[0];
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const requestId = (request as Request & { requestId?: string }).requestId;
    this.logger.warn(
      `requestId=${requestId} path=${path} status=${status} error`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    if (path.startsWith('/api')) {
      const errorMessage =
        typeof message === 'string'
          ? message
          : (message as { message?: string }).message ?? String(message);
      const errorCode =
        exception instanceof HttpException
          ? (exception.getResponse() as { error?: string })?.error ?? 'HTTP_EXCEPTION'
          : 'INTERNAL_ERROR';

      response.status(status).json({
        success: false,
        error: errorCode,
        message: errorMessage,
      });
      return;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...(typeof message === 'string' ? { message } : (message as object)),
    });
  }
}
