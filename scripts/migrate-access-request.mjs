import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const sql = neon(databaseUrl)

await sql`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS access_request_sent_at timestamptz
`

console.log("Added users.access_request_sent_at")
