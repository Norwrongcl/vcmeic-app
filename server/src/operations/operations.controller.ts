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
import { type CommandExecutor } from '../commands/executor.ts'
import { EXECUTOR } from '../cases/cases.controller.ts'
import { transaction } from '../persistence/transaction.ts'
import { resources, type ResourceDefinition } from './resources.ts'
import { readResource } from './operations.read.ts'
export function resourceController(
  definition: ResourceDefinition,
  reader: typeof readResource = readResource,
) {
  @Controller('/v1/' + definition.path)
  class ResourceController {
    constructor(
      @Inject(POOL) private pool: Pool,
      @Inject(EXECUTOR) private executor: CommandExecutor,
    ) {}
    @Get() list(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
      return transaction(this.pool, req.principal!, 'read', (tx) =>
        reader(tx, definition, undefined, query),
      )
    }
    @Get('/:id') get(
      @Req() req: AuthenticatedRequest,
      @Param('id') id: string,
    ) {
      return transaction(this.pool, req.principal!, 'read', (tx) =>
        reader(tx, definition, id),
      )
    }
    @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
      z.object({
        command: z.object({
          type: z.string().refine((t) => definition.create.includes(t)),
        }),
      }).parse(body)
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
      z.object({
        command: z.object({
          type: z.string().refine((t) => definition.commands.includes(t)),
          [definition.idKey]: z.literal(id),
        }),
      }).parse(body)
      return this.executor.executeCommand(
        req.principal!,
        body,
        crypto.randomUUID(),
      )
    }
  }
  return ResourceController
}
export const operationControllers = resources.map((r) => resourceController(r))
