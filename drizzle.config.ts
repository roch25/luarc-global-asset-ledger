import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile('.env.local')
} catch {}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
})
