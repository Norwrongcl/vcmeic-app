import {
  Controller,
  Get,
  Post,
  Req,
  Param,
  Body,
  Inject,
  HttpCode,
  Query,
} from '@nestjs/common'
import type { Pool } from 'pg'
import type { AuthenticatedRequest } from '../identity/sessions.ts'
import { POOL } from '../persistence/tokens.ts'
import { type CommandExecutor } from '../commands/executor.ts'
import { transaction } from '../persistence/transaction.ts'
import { readCase } from './cases.read.ts'
import { assertAction } from '../access/policy.ts'
import { visibilityPredicate } from '../access/visibility.ts'
import { pageInput, pageResult } from '../http/pagination.ts'
import { z } from 'zod'
export const EXECUTOR = Symbol('EXECUTOR')
@Controller('/v1/cases')
export class CasesController {
  constructor(
    @Inject(POOL) private pool: Pool,
    @Inject(EXECUTOR) private executor: CommandExecutor,
  ) {}
  @Get() async list(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
    return transaction(this.pool, req.principal!, 'read', async (tx) => {
      await assertAction(tx, 'query')
      const page = pageInput(query, tx.principal, 'cases'),
        pred = visibilityPredicate(tx.principal, 'o'),
        values = [...pred.values]
      let where = pred.sql
      if (page.after) {
        values.push(page.after)
        where += ' AND c.id>$' + values.length
      }
      const rows = await tx.client.query(
        'SELECT c.id,c.code,c.name,c.kind,c.state,c.version FROM vcm.cases c JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE ' +
          where +
          ' ORDER BY c.id LIMIT ' +
          (page.limit + 1),
        values,
      )
      return pageResult(rows.rows, page.limit, tx.principal, 'cases')
    })
  }
  @Get('/:id') get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return transaction(this.pool, req.principal!, 'read', (tx) =>
      readCase(tx, id),
    )
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    z.object({ command: z.object({ type: z.literal('createCase') }) })
      .passthrough()
      .parse(body)
    return this.executor.executeCommand(
      req.principal!,
      body,
      crypto.randomUUID(),
    )
  }
  @Post('/:id/commands') @HttpCode(200) command(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    z.object({ command: z.object({ caseId: z.literal(id) }) })
      .passthrough()
      .parse(body)
    return this.executor.executeCommand(
      req.principal!,
      body,
      crypto.randomUUID(),
    )
  }
}
