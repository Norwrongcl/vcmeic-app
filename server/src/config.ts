import { z } from 'zod'
export const configSchema = z
  .object({
    databaseUrl: z
      .string()
      .url()
      .refine((v) => /^postgres(ql)?:/.test(v)),
    webOrigins: z
      .array(
        z
          .string()
          .url()
          .refine((v) => {
            const u = new URL(v)
            return (
              u.origin === v &&
              (u.protocol === 'https:' ||
                (u.protocol === 'http:' &&
                  ['localhost', '127.0.0.1'].includes(u.hostname)))
            )
          }),
      )
      .min(1),
    production: z.boolean(),
    cursorKey: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    port: z.number().int().min(1).max(65535).default(3000),
  })
  .refine(
    (c) =>
      !c.production ||
      c.webOrigins.every((o) => new URL(o).protocol === 'https:'),
    { message: 'Production origins require HTTPS', path: ['webOrigins'] },
  )
  .refine((c) => !c.production || !!c.cursorKey, {
    message: 'Production cursor key required',
    path: ['cursorKey'],
  })
export type ServerConfig = z.input<typeof configSchema>
export function parseConfig(env: Record<string, string | undefined>) {
  return configSchema.parse({
    databaseUrl: env.DATABASE_URL,
    webOrigins: env.WEB_ORIGINS?.split(',').map((v) => v.trim()),
    production: env.NODE_ENV === 'production',
    cursorKey: env.CURSOR_KEY,
    port: Number(env.PORT ?? 3000),
  })
}
export async function loadConfig(env: Record<string, string | undefined>) {
  const { readFile, stat } = await import('node:fs/promises')
  const secret = async (
    path: string | undefined,
    fallback: string | undefined,
  ) => {
    if (!path) return fallback
    const info = await stat(path)
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error('Secret file must be private')
    return (await readFile(path, 'utf8')).trim()
  }
  return parseConfig({
    ...env,
    DATABASE_URL: await secret(env.DATABASE_URL_FILE, env.DATABASE_URL),
    CURSOR_KEY: await secret(env.CURSOR_KEY_FILE, env.CURSOR_KEY),
  })
}
