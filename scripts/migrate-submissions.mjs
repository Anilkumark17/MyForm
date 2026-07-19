import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    answers jsonb NOT NULL,
    total_completion_time_ms integer NOT NULL,
    per_field_time_ms jsonb NOT NULL,
    per_field_text_length jsonb NOT NULL,
    per_field_entropy_score jsonb NOT NULL,
    honeypot_field_filled boolean NOT NULL DEFAULT false,
    trust_score integer NOT NULL,
    flag_status varchar(20) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS form_baselines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    signal_name varchar(255) NOT NULL,
    mean double precision NOT NULL,
    stddev double precision NOT NULL,
    sample_size integer NOT NULL,
    last_computed_at timestamptz NOT NULL
  )
`

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS form_baselines_form_signal_uidx
  ON form_baselines (form_id, signal_name)
`

await sql`
  CREATE INDEX IF NOT EXISTS submissions_form_created_idx
  ON submissions (form_id, created_at DESC)
`

console.log("submissions + form_baselines ready")
