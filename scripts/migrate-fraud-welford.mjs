import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const sql = neon(databaseUrl)

await sql`
  ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fraud_running_mean double precision NOT NULL DEFAULT 0
`
await sql`
  ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fraud_running_m2 double precision NOT NULL DEFAULT 0
`
await sql`
  ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fraud_sample_count integer NOT NULL DEFAULT 0
`
await sql`
  ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fraud_window_times jsonb NOT NULL DEFAULT '[]'::jsonb
`
await sql`
  ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS z_score double precision
`
await sql`
  ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS fraud_status varchar(32) NOT NULL DEFAULT 'insufficient_data'
`

console.log("Migrated per-survey Welford fraud columns.")
