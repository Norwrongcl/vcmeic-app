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
import { z } from 'zod'
import type { AuthenticatedRequest } from '../identity/sessions.ts'
import { POOL } from '../persistence/tokens.ts'
import { EXECUTOR } from '../cases/cases.controller.ts'
import { type CommandExecutor } from '../commands/executor.ts'
import { transaction } from '../persistence/transaction.ts'
import { indicatorSummary } from './indicators.ts'
import { operationalOverview } from './overview.ts'
import { resourceController } from '../operations/operations.controller.ts'
import type { ResourceDefinition } from '../operations/resources.ts'
import { readResource } from '../operations/operations.read.ts'
import { visibilityPredicate } from '../access/visibility.ts'
const cutResource: ResourceDefinition = {
  path: 'cuts',
  table: 'institutional_cuts',
  kind: 'cut',
  idKey: 'cutId',
  create: ['createCut'],
  commands: ['addObservation', 'resolveObservation', 'transitionCut'],
  fields: {
    name: 'name',
    period: 'period',
    status: 'status',
    response: 'response',
  },
}
async function cutRead(
  tx: Parameters<typeof readResource>[0],
  definition: ResourceDefinition,
  id?: string,
  query?: unknown,
) {
  const base = await readResource(tx, definition, id, query)
  if (!id) return base
  const result = base as Record<string, unknown>,
    pred = visibilityPredicate(tx.principal, 'o', 2)
  result.caseIds = (
    await tx.client.query(
      'SELECT c.id FROM vcm.cut_cases cc JOIN vcm.cases c ON c.id=cc.case_id JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE cc.cut_id=$1 AND cc.cut_version=(SELECT max(version) FROM vcm.cut_revisions WHERE cut_id=$1) AND ' +
        pred.sql,
      [id, ...pred.values],
    )
  ).rows.map((r) => r.id)
  result.observations = (
    await tx.client.query(
      'SELECT ob.id,ob.case_id AS "caseId",ob.text,ob.status,ob.resolution FROM vcm.cut_observations ob JOIN vcm.cases c ON c.id=ob.case_id JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE ob.cut_id=$1 AND ' +
        pred.sql,
      [id, ...pred.values],
    )
  ).rows
  result.integration = 'integration_pending'
  return result
}
export const CutController = resourceController(cutResource, cutRead)
@Controller('/v1')
export class ReportingController {
  constructor(
    @Inject(POOL) private pool: Pool,
    @Inject(EXECUTOR) private executor: CommandExecutor,
  ) {}
  @Get('/indicators') indicators(
    @Req() req: AuthenticatedRequest,
    @Query('period') period?: string,
  ) {
    const year = z.coerce
      .number()
      .int()
      .min(1900)
      .max(9999)
      .parse(period ?? 2026)
    return transaction(this.pool, req.principal!, 'read', (tx) =>
      indicatorSummary(tx, year),
    )
  }
  @Get(['/overview', '/control', '/reports']) overview(
    @Req() req: AuthenticatedRequest,
    @Query('period') period?: string,
  ) {
    const year = z.coerce
      .number()
      .int()
      .min(1900)
      .max(9999)
      .parse(period ?? 2026)
    return transaction(this.pool, req.principal!, 'read', (tx) =>
      operationalOverview(tx, year),
    )
  }
  @Post('/indicators/:id/commands') @HttpCode(200) command(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    z.object({
      command: z.object({
        indicatorId: z.literal(id),
        type: z.enum(['linkIndicator', 'validateContribution']),
      }),
    }).parse(body)
    return this.executor.executeCommand(
      req.principal!,
      body,
      crypto.randomUUID(),
    )
  }
}
