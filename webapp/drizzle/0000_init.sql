-- ClientOps Intelligence Platform — Initial Schema
-- Pure AWS: RDS PostgreSQL + Drizzle ORM

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ──────────────────────────────────────────────────────────────────

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  google_id TEXT UNIQUE,
  business_name TEXT,
  business_type TEXT,
  business_website TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  onboarding_answers JSONB,
  notification_preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  scopes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Contacts ───────────────────────────────────────────────────────────────

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  role TEXT,
  relationship_type TEXT,
  relationship_stage TEXT,
  fit_score INTEGER,
  last_contact_at TIMESTAMPTZ,
  total_interactions INTEGER DEFAULT 0,
  revenue_potential NUMERIC(10,2),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- ─── Email Threads ──────────────────────────────────────────────────────────

CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  gmail_thread_id TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  business_category TEXT,
  urgency TEXT,
  business_leverage TEXT,
  current_state TEXT DEFAULT 'received',
  agent_objective TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_direction TEXT,
  message_count INTEGER DEFAULT 0,
  classification JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_thread_id)
);

-- ─── Email Messages ─────────────────────────────────────────────────────────

CREATE TABLE email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL,
  sender_email TEXT,
  sender_name TEXT,
  body_summary TEXT,
  body_full TEXT,
  sent_at TIMESTAMPTZ,
  is_agent_generated BOOLEAN DEFAULT FALSE,
  agent_action_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Follow-up Workflows ────────────────────────────────────────────────────

CREATE TABLE follow_up_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES email_threads(id),
  contact_id UUID REFERENCES contacts(id),
  workflow_type TEXT,
  current_stage TEXT,
  objective TEXT,
  constraints JSONB,
  step_function_arn TEXT,
  next_action_at TIMESTAMPTZ,
  attempt_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Agent Actions (audit trail) ────────────────────────────────────────────

CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES email_threads(id),
  workflow_id UUID REFERENCES follow_up_workflows(id),
  action_type TEXT NOT NULL,
  agent_name TEXT,
  input JSONB,
  output JSONB,
  decision_reasoning TEXT,
  risk_assessment JSONB,
  permission_rule TEXT,
  status TEXT,
  model_used TEXT,
  tokens_used INTEGER,
  cost_usd NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Trust Rules (permission ladder) ────────────────────────────────────────

CREATE TABLE trust_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  autonomy_level TEXT NOT NULL,
  conditions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- ─── Learned Preferences ────────────────────────────────────────────────────

CREATE TABLE learned_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  observation TEXT NOT NULL,
  evidence JSONB,
  confidence NUMERIC(3,2),
  status TEXT DEFAULT 'suggested',
  applies_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Meeting Briefs ─────────────────────────────────────────────────────────

CREATE TABLE meeting_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  calendar_event_id TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  brief_content JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Browser Tasks ──────────────────────────────────────────────────────────

CREATE TABLE browser_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES email_threads(id),
  objective TEXT NOT NULL,
  tier INTEGER NOT NULL,
  target_url TEXT,
  status TEXT DEFAULT 'pending',
  trace_s3_path TEXT,
  screenshot_s3_path TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Outreach Campaigns ─────────────────────────────────────────────────────

CREATE TABLE outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  campaign_name TEXT,
  target_criteria JSONB,
  message_template TEXT,
  status TEXT DEFAULT 'draft',
  stats JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Outreach Leads ─────────────────────────────────────────────────────────

CREATE TABLE outreach_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  platform_user_id TEXT,
  name TEXT,
  profile_url TEXT,
  outreach_state TEXT DEFAULT 'queued',
  messages_sent INTEGER DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Briefings ──────────────────────────────────────────────────────────────

CREATE TABLE briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX idx_email_threads_user_id ON email_threads(user_id);
CREATE INDEX idx_email_threads_last_message ON email_threads(user_id, last_message_at DESC);
CREATE INDEX idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_agent_actions_user_id ON agent_actions(user_id);
CREATE INDEX idx_agent_actions_thread_id ON agent_actions(thread_id);
CREATE INDEX idx_follow_up_workflows_user_id ON follow_up_workflows(user_id);
CREATE INDEX idx_follow_up_workflows_next_action ON follow_up_workflows(next_action_at) WHERE status = 'active';
CREATE INDEX idx_trust_rules_user_id ON trust_rules(user_id);
CREATE INDEX idx_google_tokens_user_id ON google_tokens(user_id);
