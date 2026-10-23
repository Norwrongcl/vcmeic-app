import { readFile, stat } from 'node:fs/promises'
export async function privateInput(path: string | undefined) {
  if (!path) throw new Error('Private input file path required')
  const info = await stat(path)
  if (
    !info.isFile() ||
    (info.mode & 0o077) !== 0 ||
    (process.getuid && info.uid !== process.getuid())
  )
    throw new Error('Input must be owned by operator and mode 0600')
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}
