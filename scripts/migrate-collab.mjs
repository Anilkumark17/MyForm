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
  ADD COLUMN IF NOT EXISTS questions_revision integer NOT NULL DEFAULT 0
`

await sql`
  CREATE TABLE IF NOT EXISTS project_collaborators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role varchar(20) NOT NULL DEFAULT 'editor',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id)
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS project_ops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    revision integer NOT NULL,
    client_id varchar(64) NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    op jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS project_ops_project_revision_idx
  ON project_ops (project_id, revision)
`

console.log("Collaboration tables ready")
