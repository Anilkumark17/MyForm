import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS icp text`
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS objectives text`
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS questions text`

const columns = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'projects'
`

const names = new Set(columns.map((row) => row.column_name))

if (names.has("goal") && names.has("findings")) {
  await sql`
    UPDATE projects
    SET objectives = COALESCE(
      objectives,
      NULLIF(goal, ''),
      NULLIF(findings, '')
    )
    WHERE objectives IS NULL
  `
} else if (names.has("goal")) {
  await sql`
    UPDATE projects
    SET objectives = COALESCE(objectives, NULLIF(goal, ''))
    WHERE objectives IS NULL
  `
}

if (names.has("audience")) {
  await sql`
    UPDATE projects
    SET icp = COALESCE(icp, NULLIF(audience, ''))
    WHERE icp IS NULL
  `
}

if (names.has("survey_type")) {
  await sql`ALTER TABLE projects DROP COLUMN IF EXISTS survey_type`
}
if (names.has("goal")) {
  await sql`ALTER TABLE projects DROP COLUMN IF EXISTS goal`
}
if (names.has("findings")) {
  await sql`ALTER TABLE projects DROP COLUMN IF EXISTS findings`
}
if (names.has("audience")) {
  await sql`ALTER TABLE projects DROP COLUMN IF EXISTS audience`
}
if (names.has("success_metric")) {
  await sql`ALTER TABLE projects DROP COLUMN IF EXISTS success_metric`
}

const finalColumns = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'projects'
  ORDER BY ordinal_position
`

console.log(
  "projects columns:",
  finalColumns.map((row) => row.column_name)
)
