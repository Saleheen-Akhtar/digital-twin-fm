import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/jwt-auth.guard';

// /health is intentionally public so uptime monitors, load balancers, and
// the docker healthcheck don't need to carry a JWT.
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
