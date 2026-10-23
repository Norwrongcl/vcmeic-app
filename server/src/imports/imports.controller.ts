import {
  Controller,
  Post,
  Get,
  Req,
  Param,
  Body,
  Inject,
  HttpCode,
} from '@nestjs/common'
import type { Pool } from 'pg'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../identity/sessions.ts'
import { POOL } from '../persistence/tokens.ts'
import { EXECUTOR } from '../cases/cases.controller.ts'
import { type CommandExecutor } from '../commands/executor.ts'
import { transaction } from '../persistence/transaction.ts'
import { assertAction } from '../access/policy.ts'
import { ApiError } from '../http/errors.ts'
import { importPreview } from './preview.ts'
import { scopedExport } from './export.ts'
@Controller('/v1')
export class ImportsController {
  constructor(
    @Inject(POOL) private pool: Pool,
    @Inject(EXECUTOR) private executor: CommandExecutor,
  ) {}
  @Post('/imports/preview') preview(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const dto = z.strictObject({ snapshot: z.unknown() }).parse(body)
    return transaction(this.pool, req.principal!, crypto.randomUUID(), (tx) =>
      importPreview(tx, dto.snapshot),
    )
  }
  @Get('/imports/:id') get(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return transaction(this.pool, req.principal!, 'import-read', async (tx) => {
      if (tx.principal.kind !== 'human')
        throw new ApiError(
          403,
          'IMPORT_DENIED',
          'Se requiere una sesión humana de gestión.',
        )
      await assertAction(tx, 'editOperationalDraft', 'import:' + id)
      const row = (
        await tx.client.query(
          'SELECT id,source_version AS "sourceVersion",source_hash hash,status,created_at AS "createdAt" FROM vcm.import_batches WHERE id=$1',
          [id],
        )
      ).rows[0]
      return {
        ...row,
        issues: (
          await tx.client.query(
            'SELECT entity_type AS "entityType",legacy_id AS "legacyId",code,detail,status FROM vcm.import_issues WHERE batch_id=$1 ORDER BY id',
            [id],
          )
        ).rows,
        mappings: (
          await tx.client.query(
            'SELECT entity_type AS "entityType",legacy_id AS "legacyId",internal_id AS "internalId",demo FROM vcm.import_mappings WHERE batch_id=$1 AND entity_type<>\'__snapshot\' ORDER BY entity_type,legacy_id',
            [id],
          )
        ).rows,
      }
    })
  }
  @Post('/imports/:id/commit') @HttpCode(200) commit(
    @Req() req: AuthenticatedRequest,
    @Param('id') batchId: string,
    @Body() body: unknown,
  ) {
    const dto = z
      .strictObject({
        previewHash: z.string().length(64),
        actorMappings: z.record(z.string(), z.string().min(1)),
        includeDemo: z.boolean(),
        demoClassifications: z.record(z.string(), z.boolean()).optional(),
        backupReceiptId: z.string().min(1),
        idempotencyKey: z.string().min(8).max(200),
      })
      .parse(body)
    const { idempotencyKey, ...fields } = dto
    return this.executor.executeCommand(
      req.principal!,
      {
        command: { type: 'commitImport', batchId, ...fields },
        expectedVersion: 1,
        idempotencyKey,
      },
      crypto.randomUUID(),
    )
  }
  @Get('/exports') export(@Req() req: AuthenticatedRequest) {
    return transaction(this.pool, req.principal!, crypto.randomUUID(), (tx) =>
      scopedExport(tx),
    )
  }
}
