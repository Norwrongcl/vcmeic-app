import { writeFile } from 'node:fs/promises'
import { openApiDocument } from '../dist/server/src/openapi.js'
import { createDomainRegistry } from '../dist/server/src/commands/domain-registry.js'
await writeFile(
  new URL('../docs/openapi.json', import.meta.url),
  JSON.stringify(openApiDocument(createDomainRegistry()), null, 2) + '\n',
)
process.stdout.write('Generated server/docs/openapi.json\n')
