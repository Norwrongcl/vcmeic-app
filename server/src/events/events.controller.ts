import { Controller, Get, Req, Res, Inject } from '@nestjs/common'
import type { Pool } from 'pg'
import type { Response } from 'express'
import type { ServerConfig } from '../config.ts'
import { POOL, IDENTITY, CONFIG } from '../persistence/tokens.ts'
import {
  type Identity,
  type AuthenticatedRequest,
} from '../identity/sessions.ts'
import { openEventStream } from './stream.ts'
@Controller('/v1/events')
export class EventsController {
  constructor(
    @Inject(POOL) private pool: Pool,
    @Inject(IDENTITY) private identity: Identity,
    @Inject(CONFIG) private config: ServerConfig,
  ) {}
  @Get() events(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    openEventStream(this.pool, this.identity, this.config.cursorKey!, req, res)
  }
}
