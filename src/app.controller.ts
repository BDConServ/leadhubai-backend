// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status:    'ok',
      service:   'leadhub-api',
      timestamp: new Date().toISOString(),
      env:       process.env.NODE_ENV,
    };
  }
}
