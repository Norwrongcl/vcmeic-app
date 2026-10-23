import { z } from 'zod'
// Discriminator parsed here; each registry handler applies its own closed Zod schema before execution.
export const commandSchema = z
  .object({ type: z.string().min(1).max(80) })
  .catchall(z.unknown())
export const envelopeSchema = z.strictObject({
  command: commandSchema,
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(8).max(200),
})
export type CommandEnvelope = z.infer<typeof envelopeSchema>
