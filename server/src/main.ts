import { createApp } from './app.module.ts'
import { loadConfig } from './config.ts'
const config = await loadConfig(process.env)
const app = await createApp(config)
app.enableShutdownHooks()
await app.listen(config.port, '0.0.0.0')
