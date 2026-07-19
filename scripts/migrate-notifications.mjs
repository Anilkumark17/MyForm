import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const sql = neon(databaseUrl)

await sql`
  CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
    type varchar(40) NOT NULL DEFAULT 'fake_flagged',
    title varchar(200) NOT NULL,
    body text NOT NULL,
    read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON notifications (user_id)
`

await sql`
  CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, read)
`

console.log("Created notifications table")
