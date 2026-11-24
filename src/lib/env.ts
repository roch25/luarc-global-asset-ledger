import 'server-only'
import { z } from 'zod'

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | undefined

/**
 * Validated server environment. Parsed lazily so that `next build` does not require
 * runtime secrets; the first request that needs the database will fail loudly instead.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`)
  }
  cached = parsed.data
  return cached
}
