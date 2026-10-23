import {
  Controller,
  Get,
  Post,
  Req,
  Body,
  Inject,
  HttpCode,
} from '@nestjs/common'
import type { Pool } from 'pg'
import type { AuthenticatedRequest } from '../identity/sessions.ts'
import { commandCatalog } from '../openapi.ts'
import { EXECUTOR } from '../cases/cases.controller.ts'
import { type CommandExecutor } from '../commands/executor.ts'
import { POOL } from '../persistence/tokens.ts'
import { transaction } from '../persistence/transaction.ts'
import { assertAction } from '../access/policy.ts'
import { domainCatalog } from './catalog.ts'
import { semanticQuery } from './compiler.ts'
@Controller('/v1')
export class QueryController {
  constructor(
    @Inject(POOL) private pool: Pool,
    @Inject(EXECUTOR) private executor: CommandExecutor,
  ) {}
  @Get('/catalog') catalog(@Req() req: AuthenticatedRequest) {
    return transaction(this.pool, req.principal!, 'catalog', async (tx) => {
      await assertAction(tx, 'query')
      return {
        ...domainCatalog(tx.principal),
        commands: commandCatalog(this.executor.registry, tx.principal),
        catalogues: {
          portfolios: (
            await tx.client.query(
              'SELECT id,code,name FROM vcm.portfolios WHERE active ORDER BY name',
            )
          ).rows,
          presenceTypes: (
            await tx.client.query(
              "SELECT code,label FROM vcm.catalog_entries WHERE catalog_version_id='presence-2026.09-v1' AND active ORDER BY code",
            )
          ).rows,
          fields: (
            await tx.client.query(
              'SELECT schema_version AS "schemaVersion",field_key AS "fieldId",label,group_name AS "group",value_type AS "valueType",classification FROM vcm.field_definitions ORDER BY schema_version,field_key',
            )
          ).rows,
        },
      }
    })
  }
  @Post('/query') @HttpCode(200) query(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return transaction(
      this.pool,
      req.principal!,
      crypto.randomUUID(),
      async (tx) => {
        await assertAction(tx, 'query')
        return semanticQuery(tx, body)
      },
    )
  }
}
