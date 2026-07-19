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
  ADD COLUMN IF NOT EXISTS fraud_pending_since_mean integer NOT NULL DEFAULT 0
`

console.log("Added projects.fraud_pending_since_mean")
