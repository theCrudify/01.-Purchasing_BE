import { serve } from '@hono/node-server'
import { app } from './index'

// Local / Node hosting. On Vercel the default export of src/index.ts is used; on Cloudflare see wrangler.toml.
const port = Number(process.env.PORT ?? 3918)
serve({ fetch: app.fetch, port }, () => console.log(`Purchasing BE on http://localhost:${port}`))
