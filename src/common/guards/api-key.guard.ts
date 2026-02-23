import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const PUBLIC_PATHS = ['/health', '/api/health'];

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = (req.path || req.url || '').split('?')[0];

    if (PUBLIC_PATHS.includes(path)) {
      return true;
    }

    const expected =
      this.configService.get<string>('INTERNAL_API_KEY') ||
      process.env.INTERNAL_API_KEY ||
      '';

    if (!expected) {
      throw new UnauthorizedException('INTERNAL_API_KEY not configured');
    }

    const provided = (req.headers['x-api-key'] as string) || '';
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
