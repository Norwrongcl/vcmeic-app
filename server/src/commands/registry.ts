import type { z } from 'zod'
import type { CommandResult, TransactionContext } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
export type Target = { objectId: string; version: number }
export type Mutation = CommandResult & { before?: unknown; after?: unknown }
export interface Handler<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string
  action: string
  schema: z.ZodType<T>
  target(tx: TransactionContext, command: T): Promise<Target | undefined>
  run(
    tx: TransactionContext,
    command: T,
    target: Target | undefined,
  ): Promise<Mutation>
}
export class CommandRegistry {
  private handlers = new Map<string, Handler>()
  register<T extends Record<string, unknown>>(
    handler: { schema: z.ZodType<T> } & Omit<Handler<NoInfer<T>>, 'schema'>,
  ) {
    if (this.handlers.has(handler.type))
      throw new Error('Duplicate command ' + handler.type)
    this.handlers.set(handler.type, handler as unknown as Handler)
  }
  resolve(type: unknown) {
    if (typeof type !== 'string' || !this.handlers.has(type))
      throw new ApiError(422, 'UNKNOWN_COMMAND', 'Comando no soportado.')
    return this.handlers.get(type)!
  }
  entries() {
    return [...this.handlers.values()]
  }
}
