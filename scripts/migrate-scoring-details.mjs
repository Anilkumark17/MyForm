import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS scoring_details jsonb`
console.log("scoring_details column ready")
