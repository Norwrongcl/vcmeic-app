import { Controller, Get, Inject } from '@nestjs/common'
import type { Pool } from 'pg'
import { POOL } from '../persistence/tokens.ts'
@Controller()
export class HealthController {
  constructor(@Inject(POOL) private pool: Pool) {}
  @Get('/health') health() {
    return { status: 'ok' }
  }
  @Get('/ready') async ready() {
    await this.pool.query('SELECT 1')
    return { status: 'ready' }
  }
}
