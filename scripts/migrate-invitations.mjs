import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const sql = neon(databaseUrl)

await sql`
  CREATE TABLE IF NOT EXISTS invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    inviter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_email varchar(255) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS invitations_invitee_email_idx
  ON invitations (invitee_email)
`

await sql`
  CREATE INDEX IF NOT EXISTS invitations_project_id_idx
  ON invitations (project_id)
`

console.log("Created invitations table")
