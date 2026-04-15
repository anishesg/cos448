import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
  boolean,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return "vector(1024)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown) {
    const str = String(value);
    return str
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});

// ─── Users ──────────────────────────────────────────────────────────────────

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  googleId: text("google_id").unique(),
  businessName: text("business_name"),
  businessType: text("business_type"),
  businessWebsite: text("business_website"),
  timezone: text("timezone").default("America/New_York"),
  onboardingAnswers: jsonb("onboarding_answers"),
  notificationPreferences: jsonb("notification_preferences"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const googleTokens = pgTable("google_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  scopes: text("scopes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Contacts ───────────────────────────────────────────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    company: text("company"),
    role: text("role"),
    relationshipType: text("relationship_type"),
    relationshipStage: text("relationship_stage"),
    fitScore: integer("fit_score"),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    totalInteractions: integer("total_interactions").default(0),
    revenuePotential: numeric("revenue_potential", {
      precision: 10,
      scale: 2,
    }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("contacts_user_email_idx").on(table.userId, table.email)]
);

// ─── Email Threads ──────────────────────────────────────────────────────────

export const emailThreads = pgTable(
  "email_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id),
    gmailThreadId: text("gmail_thread_id").notNull(),
    subject: text("subject"),
    snippet: text("snippet"),
    businessCategory: text("business_category"),
    urgency: text("urgency"),
    businessLeverage: text("business_leverage"),
    currentState: text("current_state").default("received"),
    agentObjective: text("agent_objective"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessageDirection: text("last_message_direction"),
    messageCount: integer("message_count").default(0),
    classification: jsonb("classification"),
    automationStatus: text("automation_status"),
    automationTurns: integer("automation_turns").default(0),
    automationMaxTurns: integer("automation_max_turns").default(8),
    isTestSimulation: boolean("is_test_simulation").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("threads_user_gmail_idx").on(table.userId, table.gmailThreadId),
  ]
);

// ─── Email Messages ─────────────────────────────────────────────────────────

export const emailMessages = pgTable("email_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => emailThreads.id, { onDelete: "cascade" }),
  gmailMessageId: text("gmail_message_id").notNull().unique(),
  direction: text("direction").notNull(),
  senderEmail: text("sender_email"),
  senderName: text("sender_name"),
  bodySummary: text("body_summary"),
  bodyFull: text("body_full"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  isAgentGenerated: boolean("is_agent_generated").default(false),
  agentActionId: uuid("agent_action_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Follow-up Workflows ────────────────────────────────────────────────────

export const followUpWorkflows = pgTable("follow_up_workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => emailThreads.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  workflowType: text("workflow_type"),
  currentStage: text("current_stage"),
  objective: text("objective"),
  constraints: jsonb("constraints"),
  stepFunctionArn: text("step_function_arn"),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  attemptCount: integer("attempt_count").default(0),
  status: text("status").default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Agent Actions (audit trail) ────────────────────────────────────────────

export const agentActions = pgTable("agent_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id").references(() => emailThreads.id),
  workflowId: uuid("workflow_id").references(() => followUpWorkflows.id),
  actionType: text("action_type").notNull(),
  agentName: text("agent_name"),
  input: jsonb("input"),
  output: jsonb("output"),
  decisionReasoning: text("decision_reasoning"),
  riskAssessment: jsonb("risk_assessment"),
  permissionRule: text("permission_rule"),
  status: text("status"),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Trust Rules (permission ladder) ────────────────────────────────────────

export const trustRules = pgTable(
  "trust_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    autonomyLevel: text("autonomy_level").notNull(),
    conditions: jsonb("conditions"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("trust_rules_user_category_idx").on(table.userId, table.category),
  ]
);

// ─── Learned Preferences ────────────────────────────────────────────────────

export const learnedPreferences = pgTable("learned_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  observation: text("observation").notNull(),
  evidence: jsonb("evidence"),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  status: text("status").default("suggested"),
  appliesTo: text("applies_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Meeting Briefs ─────────────────────────────────────────────────────────

export const meetingBriefs = pgTable("meeting_briefs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  calendarEventId: text("calendar_event_id").notNull(),
  contactId: uuid("contact_id").references(() => contacts.id),
  briefContent: jsonb("brief_content"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

// ─── Browser Tasks ──────────────────────────────────────────────────────────

export const browserTasks = pgTable("browser_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  threadId: uuid("thread_id").references(() => emailThreads.id),
  objective: text("objective").notNull(),
  tier: integer("tier").notNull(),
  targetUrl: text("target_url"),
  status: text("status").default("pending"),
  traceS3Path: text("trace_s3_path"),
  screenshotS3Path: text("screenshot_s3_path"),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Outreach Campaigns ─────────────────────────────────────────────────────

export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  campaignName: text("campaign_name"),
  targetCriteria: jsonb("target_criteria"),
  messageTemplate: text("message_template"),
  status: text("status").default("draft"),
  stats: jsonb("stats"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Outreach Leads ─────────────────────────────────────────────────────────

export const outreachLeads = pgTable("outreach_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id),
  platformUserId: text("platform_user_id"),
  name: text("name"),
  profileUrl: text("profile_url"),
  outreachState: text("outreach_state").default("queued"),
  messagesSent: integer("messages_sent").default(0),
  lastActionAt: timestamp("last_action_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Briefings ──────────────────────────────────────────────────────────────

export const briefings = pgTable("briefings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: jsonb("content"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

// ─── Knowledge Base (RAG) ───────────────────────────────────────────────────

export const knowledgeSources = pgTable("knowledge_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  title: text("title"),
  status: text("status").default("pending"),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => knowledgeSources.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    embedding: vector("embedding"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("knowledge_chunks_user_idx").on(table.userId),
  ]
);

// ─── Contact Research ───────────────────────────────────────────────────────

export const contactResearch = pgTable("contact_research", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  researchType: text("research_type").notNull(),
  summary: text("summary"),
  rawData: jsonb("raw_data"),
  sources: jsonb("sources"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
