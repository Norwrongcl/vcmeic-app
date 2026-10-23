import { Controller, Get, Inject } from '@nestjs/common'
import { EXECUTOR } from '../cases/cases.controller.ts'
import { type CommandExecutor } from '../commands/executor.ts'
import { openApiDocument } from '../openapi.ts'
@Controller('/v1/openapi.json')
export class OpenApiController {
  constructor(@Inject(EXECUTOR) private executor: CommandExecutor) {}
  @Get() document() {
    return openApiDocument(this.executor.registry)
  }
}
