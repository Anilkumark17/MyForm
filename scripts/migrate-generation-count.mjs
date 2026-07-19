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
  ADD COLUMN IF NOT EXISTS generation_count integer NOT NULL DEFAULT 0
`

console.log("Added users.generation_count")
