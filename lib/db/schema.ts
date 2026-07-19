import { relations } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** Successful AI question generations used (free tier capped). */
  generationCount: integer("generation_count").notNull().default(0),
  /** When we last emailed the admin about this user hitting a free limit. */
  accessRequestSentAt: timestamp("access_request_sent_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  icp: text("icp"),
  objectives: text("objectives"),
  questions: text("questions"),
  /** Per-survey Welford running mean of completion time (seconds). */
  fraudRunningMean: doublePrecision("fraud_running_mean").notNull().default(0),
  /** Welford M2 accumulator for completion time. */
  fraudRunningM2: doublePrecision("fraud_running_m2").notNull().default(0),
  fraudSampleCount: integer("fraud_sample_count").notNull().default(0),
  /** Clean samples since last mean rebuild (mean refreshes every 15). */
  fraudPendingSinceMean: integer("fraud_pending_since_mean")
    .notNull()
    .default(0),
  /** Last N completion times (seconds) for rolling-window rebuild. */
  fraudWindowTimes: jsonb("fraud_window_times")
    .$type<number[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  formId: uuid("form_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
  /** Campaign / traffic source segment when available (utm_source, etc.) */
  source: varchar("source", { length: 255 }),
  totalCompletionTimeMs: integer("total_completion_time_ms").notNull(),
  perFieldTimeMs: jsonb("per_field_time_ms")
    .$type<Record<string, number>>()
    .notNull(),
  perFieldTextLength: jsonb("per_field_text_length")
    .$type<Record<string, number>>()
    .notNull(),
  perFieldEntropyScore: jsonb("per_field_entropy_score")
    .$type<Record<string, number>>()
    .notNull(),
  honeypotFieldFilled: boolean("honeypot_field_filled").notNull().default(false),
  /** Completion-time z-score (lower-tail fraud); null when insufficient data. */
  zScore: doublePrecision("z_score"),
  /**
   * Fine-grained fraud status from Welford pipeline.
   * insufficient_data | normal | flagged | rejected
   */
  fraudStatus: varchar("fraud_status", { length: 32 })
    .notNull()
    .default("insufficient_data"),
  trustScore: integer("trust_score").notNull(),
  /** Legacy dashboard field: clean | flagged (rejected maps to flagged). */
  flagStatus: varchar("flag_status", { length: 20 }).notNull(),
  scoringDetails: jsonb("scoring_details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const formBaselines = pgTable(
  "form_baselines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    signalName: varchar("signal_name", { length: 255 }).notNull(),
    mean: doublePrecision("mean").notNull(),
    stddev: doublePrecision("stddev").notNull(),
    sampleSize: integer("sample_size").notNull(),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true })
      .notNull(),
  },
  (table) => [
    unique("form_baselines_form_signal_uidx").on(
      table.formId,
      table.signalName
    ),
  ]
)

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projects: many(projects),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  submissions: many(submissions),
  baselines: many(formBaselines),
}))

export const submissionsRelations = relations(submissions, ({ one }) => ({
  form: one(projects, {
    fields: [submissions.formId],
    references: [projects.id],
  }),
}))

export const formBaselinesRelations = relations(formBaselines, ({ one }) => ({
  form: one(projects, {
    fields: [formBaselines.formId],
    references: [projects.id],
  }),
}))

export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Project = typeof projects.$inferSelect
export type Submission = typeof submissions.$inferSelect
export type FormBaseline = typeof formBaselines.$inferSelect
export type FlagStatus = "clean" | "flagged"
export type FraudStatus =
  | "insufficient_data"
  | "normal"
  | "flagged"
  | "rejected"
