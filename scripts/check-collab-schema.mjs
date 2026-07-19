import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

const cols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'projects'
    AND column_name = 'questions_revision'
`

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('project_collaborators', 'project_ops')
`

const probe = await sql`
  SELECT id, questions_revision
  FROM projects
  LIMIT 1
`

console.log({ cols, tables, probe })
