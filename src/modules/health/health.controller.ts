import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Root health check endpoint',
    description: 'Returns service status immediately for deployment health checks',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'pdf-generator' },
      },
    },
  })
  getRoot() {
    return { status: 'ok', service: 'pdf-generator' };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the current status of the PDF generation service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is running properly',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'pdf-generator' },
      },
    },
  })
  getHealth() {
    return { status: 'ok', service: 'pdf-generator' };
  }

  @Get('api/health')
  @ApiOperation({
    summary: 'API health check (public, no x-api-key required)',
    description: 'Same as /health for compatibility with frontend',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is running properly',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'pdf-generator' },
      },
    },
  })
  getApiHealth() {
    return { status: 'ok', service: 'pdf-generator' };
  }
}
