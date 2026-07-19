import "dotenv/config"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { desc, eq } from "drizzle-orm"
import * as schema from "../lib/db/schema.ts"

const sql = neon(process.env.DATABASE_URL)
const db = drizzle(sql, { schema })

const userId = "54c627f8-35ca-41c6-992c-723de0f6d6f9"

const owned = await db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.userId, userId))
  .orderBy(desc(schema.projects.updatedAt))

console.log("owned count", owned.length)
console.log("ok")
