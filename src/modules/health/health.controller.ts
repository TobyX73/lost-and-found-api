import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
