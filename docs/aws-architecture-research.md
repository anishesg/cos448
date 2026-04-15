# AWS Architecture for Production Agentic Application
## Solo Service Business Email Processing & Follow-Up Platform

*Research Date: April 15, 2026*

---

## Executive Summary

**Recommended Architecture: Hybrid Supabase + AWS**

After extensive research, the optimal architecture for a solo-dev startup building an agentic email processing app combines:
- **Supabase** for database, auth, realtime, and file storage (faster to build, cheaper at startup scale)
- **AWS** for compute-heavy workloads: Step Functions orchestration, Lambda for event processing, ECS Fargate for Playwright browser automation, and SQS/EventBridge for queuing and scheduling

This hybrid approach minimizes operational overhead while providing the scalability needed for production agentic workflows.

**Estimated Monthly Cost: $50–150/mo at 100 users, $300–800/mo at 1,000 users** (details in Cost section below).

---

## 1. Compute Layer

### API Server: ECS Fargate (Recommended)

| Option | Verdict | Reason |
|--------|---------|--------|
| **AWS Lambda** | Good for event handlers, not for main API | Cold starts, 15-min timeout, INIT billing change (Aug 2025) now charges for initialization phase |
| **ECS Fargate** | **Recommended for main API** | Persistent connections, predictable pricing (~$9.73/mo for 0.25 vCPU), no cold starts |
| **App Runner** | **DEAD** | AWS discontinued App Runner — no new customers after April 30, 2026. Do NOT use. |
| **ECS Express Mode** | Worth watching | AWS's replacement for App Runner; App Runner-like simplicity within ECS ecosystem |

**Recommendation:** Run your Next.js/Node API on **ECS Fargate** with a small always-on task (0.25 vCPU, 0.5GB RAM = ~$9.73/mo). This handles WebSocket connections for realtime, serves the API, and avoids Lambda cold start issues.

### Async Agent Tasks: AWS Lambda

Lambda remains excellent for event-driven, short-lived tasks:
- Processing Gmail webhook notifications
- Running individual agent steps (classify email, draft response, etc.)
- Handling SQS queue consumers
- EventBridge scheduled task triggers

**Key constraint:** Lambda has a 15-minute max timeout. Each agent "step" should complete within this window. For longer workflows, use Step Functions to chain steps.

**Cost at scale:** 1M requests/month free tier. At 100 users processing ~50 emails/day each = ~150K Lambda invocations/month = **well within free tier**.

### Browser Automation: ECS Fargate (Dedicated)

Playwright **requires** a container environment with Chromium installed. This cannot run on Lambda.

**Architecture:**
```
SQS Queue (browser tasks) → ECS Fargate Task (Playwright container) → S3 (screenshots/traces)
```

**Container setup:**
- Base image: `mcr.microsoft.com/playwright:v1.x-jammy`
- Task size: 1 vCPU, 2GB RAM minimum (Chromium is memory-hungry)
- Run as **spot tasks** triggered on-demand by SQS messages (not always-on)
- Store screenshots, PDFs, and browser traces in S3

**Cost:** Spot Fargate pricing: ~$0.01253/vCPU-hour + $0.00139/GB-hour. A 5-minute browser task costs ~$0.002. At 1,000 tasks/month = **~$2/month**.

---

## 2. Database Layer

### Primary Database: Supabase PostgreSQL (Recommended)

| Option | Monthly Cost | Verdict |
|--------|-------------|---------|
| **Supabase Pro** | **$25/mo** (8GB, 100K MAU, daily backups) | **Recommended** |
| RDS PostgreSQL (db.t4g.micro) | $11.52/mo (bare minimum, no backups) | Cheaper but much more ops work |
| Aurora Serverless v2 | $43.20/mo minimum (0.5 ACU floor) | Overkill and 4x more expensive than RDS for steady workloads |
| DynamoDB | $0 at low scale (25GB free) | No SQL, limited query flexibility |

**Why Supabase wins for this use case:**
1. **Built-in auth** with Google OAuth support — eliminates need for Cognito
2. **Row-Level Security (RLS)** — multi-tenant security built into the database
3. **Realtime subscriptions** — WebSocket-based notifications for free (no AppSync/SNS needed)
4. **Auto-generated REST/GraphQL APIs** via PostgREST — less API code to write
5. **Edge Functions** — serverless functions for lightweight tasks
6. **File storage** — S3-compatible storage with CDN built in
7. **pgvector extension** — vector search for semantic email memory without a separate vector DB
8. **Dashboard + SQL editor** — instant visibility into your data
9. **$25/mo all-in** vs stitching together RDS + Cognito + AppSync + S3

**Schema design for agent memory:**
```sql
-- Business contacts and relationship state
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  relationship_stage TEXT, -- 'lead', 'prospect', 'client', 'dormant'
  last_contact_at TIMESTAMPTZ,
  metadata JSONB,
  embedding VECTOR(1536) -- for semantic search via pgvector
);

-- Email processing history
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  contact_id UUID REFERENCES contacts(id),
  gmail_message_id TEXT UNIQUE,
  thread_id TEXT,
  subject TEXT,
  body_summary TEXT,
  classification JSONB, -- {intent, urgency, sentiment, topics}
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent workflow state (long-running follow-up loops)
CREATE TABLE agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  contact_id UUID REFERENCES contacts(id),
  workflow_type TEXT, -- 'follow_up_sequence', 'onboarding', 're_engagement'
  state JSONB, -- full workflow state for resumption
  step_function_execution_arn TEXT, -- link to AWS Step Functions execution
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed', 'failed'
  next_action_at TIMESTAMPTZ, -- when to trigger next step
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent action log (audit trail)
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES agent_workflows(id),
  action_type TEXT, -- 'email_sent', 'email_drafted', 'browser_task', 'classification'
  input JSONB,
  output JSONB,
  model_used TEXT,
  tokens_used INTEGER,
  cost_usd NUMERIC(10,6),
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### When to Add DynamoDB

DynamoDB becomes useful if you need:
- Ultra-high-throughput key-value lookups for agent checkpoints (e.g., LangGraph DynamoDBSaver)
- Session state for active conversations (sub-ms reads)
- A scratchpad for agent intermediate state during execution

**Verdict:** Start with Supabase PostgreSQL for everything. Add DynamoDB later only if you hit Postgres performance limits on agent state reads/writes (unlikely at <1,000 users).

### Caching: Skip Redis Initially

| Option | Monthly Cost | Verdict |
|--------|-------------|---------|
| Upstash Redis | $0 (free tier: 10K cmd/day) | Add if needed |
| ElastiCache | $11.68/mo minimum | Overkill at startup |

**Recommendation:** Don't add a Redis layer until you have a clear caching need. Supabase Postgres handles most query patterns fine at this scale. If you need queuing, use SQS (not Redis). If you need caching later, start with Upstash (pay-per-use, serverless).

---

## 3. Queuing & Orchestration

### Long-Running Agent Workflows: AWS Step Functions (Critical)

Step Functions is the **single most important AWS service** for this application. It manages the multi-day/multi-week follow-up loops that are core to the business logic.

**Why Step Functions:**
- Built-in state management (no custom state machine code)
- Workflows can run for **up to 1 year** (Express: 5 min, Standard: 1 year)
- Automatic retry with exponential backoff
- Visual execution tracking for debugging
- Wait states that pause execution for days/weeks (no compute cost while waiting)
- 2025 updates: AIAgentMap state for parallel agent executions, intelligent retry logic

**Example: Follow-Up Sequence Workflow**
```json
{
  "Comment": "Multi-week follow-up sequence",
  "StartAt": "ClassifyContact",
  "States": {
    "ClassifyContact": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:classifyContact",
      "Next": "DraftFollowUp"
    },
    "DraftFollowUp": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:draftEmail",
      "Next": "WaitForApproval"
    },
    "WaitForApproval": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sqs:sendMessage.waitForTaskToken",
      "Parameters": {
        "QueueUrl": "...",
        "MessageBody": { "taskToken.$": "$$.Task.Token", "draft.$": "$.draft" }
      },
      "Next": "SendEmail"
    },
    "SendEmail": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:sendEmail",
      "Next": "WaitForResponse"
    },
    "WaitForResponse": {
      "Type": "Wait",
      "TimestampPath": "$.nextFollowUpAt",
      "Next": "CheckForResponse"
    },
    "CheckForResponse": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:checkResponse",
      "Next": "ResponseReceived?"
    },
    "ResponseReceived?": {
      "Type": "Choice",
      "Choices": [
        { "Variable": "$.responded", "BooleanEquals": true, "Next": "HandleResponse" },
        { "Variable": "$.attemptCount", "NumericGreaterThan": 3, "Next": "MarkDormant" }
      ],
      "Default": "DraftFollowUp"
    },
    "HandleResponse": { "Type": "Succeed" },
    "MarkDormant": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:markDormant",
      "End": true
    }
  }
}
```

**Cost:** Standard workflows: $0.025 per 1,000 state transitions. A follow-up sequence with ~20 state transitions costs $0.0005. At 1,000 active workflows: **~$0.50/month**.

### Task Queues: Amazon SQS

Use SQS for decoupling and buffering:
- **Email processing queue** — Gmail webhook → SQS → Lambda processor
- **Browser task queue** — Agent decision → SQS → ECS Fargate Playwright task
- **Notification queue** — Agent actions → SQS → notification dispatcher

**Cost:** 1M requests/month free. Standard queues: $0.40/million requests beyond free tier. **Effectively free at startup scale.**

### Scheduling: Amazon EventBridge Scheduler

EventBridge Scheduler handles all time-based triggers:
- **Morning briefing** (7 AM user timezone): summarize overnight emails, today's follow-ups
- **Evening wrap-up** (6 PM): summarize day's activity, suggest next-day priorities
- **Follow-up timing**: one-time schedules for "send follow-up in 3 days"
- **Gmail watch renewal**: every 6 days (watch expires after 7)

**Cost:** 14 million invocations/month free tier. **Completely free at this scale.**

### Notifications: SNS + Supabase Realtime

| Channel | Service | Use Case |
|---------|---------|----------|
| In-app realtime | **Supabase Realtime** | Live updates in the dashboard (new email classified, draft ready) |
| Push notifications | **SNS** | Mobile push for urgent emails requiring attention |
| Email notifications | **SES** | Daily briefing summaries, weekly reports |

---

## 4. AI/ML Layer

### Model Access: Direct API Calls (Recommended over Bedrock)

| Approach | Pros | Cons |
|----------|------|------|
| **Direct OpenAI/Anthropic API** | Cheapest per-token, latest models immediately, simpler integration | Vendor lock-in risk, manage API keys yourself |
| **Amazon Bedrock** | AWS-native, single billing, Knowledge Bases/Agents features | 20-35% more expensive all-in, model availability lag, hidden infra costs |
| **Bedrock AgentCore** | Managed agent runtime, browser runtime, session isolation | New service, less community knowledge, potential lock-in |

**Recommendation: Call OpenAI and Anthropic APIs directly.**

**Rationale:**
1. **Cost:** Base token prices are identical for Claude on Bedrock vs Anthropic direct, but Bedrock adds hidden costs (CloudWatch logging, Knowledge Base OpenSearch infra, cross-region surcharges) that add $350+/month unexpectedly
2. **OpenAI is significantly cheaper:** GPT-4.1 mini at $0.40/$1.60 per 1M tokens vs Claude Sonnet at $3/$15 — an 8-10x difference for comparable quality on structured tasks like email classification
3. **Model flexibility:** Switch between providers based on task (GPT-4.1 mini for classification, Claude for drafting, etc.)
4. **Speed of access:** New models available day-one vs weeks/months delay on Bedrock

**Model strategy for email processing:**
| Task | Model | Cost per 1K emails |
|------|-------|-------------------|
| Email classification (intent, urgency, sentiment) | GPT-4.1 mini | ~$0.08 |
| Draft response generation | Claude Sonnet 4 | ~$1.50 |
| Contact relationship summary | GPT-4.1 mini | ~$0.12 |
| Complex reasoning (negotiation, proposal) | Claude Opus 4 | ~$5.00 |

**Monthly AI cost estimate at 1,000 users (50 emails/user/day):**
- 50,000 emails/day × 30 days = 1.5M emails/month
- Classification (all): ~$120/mo
- Draft generation (~20% need responses): ~$450/mo  
- Summaries and briefings: ~$50/mo
- **Total: ~$620/mo** (this is the largest variable cost)

### Knowledge Base / RAG

Instead of Bedrock Knowledge Bases, use **pgvector in Supabase PostgreSQL**:
- Store email embeddings alongside structured data in one database
- Use Supabase's built-in vector similarity search
- No additional infrastructure (no OpenSearch Serverless at $0.023/GB/month)
- Simpler architecture, lower cost

---

## 5. Storage

### Documents & Screenshots: S3

| Storage Type | Service | Cost |
|-------------|---------|------|
| Browser screenshots/traces | **S3 Standard** | $0.023/GB/mo |
| Email attachments (archive) | **S3 Infrequent Access** | $0.0125/GB/mo |
| Generated reports/PDFs | **S3 Standard** | $0.023/GB/mo |
| User uploads (small files) | **Supabase Storage** | Included in Pro plan (100GB) |

**Recommendation:** Use Supabase Storage for user-facing files (profile images, uploaded docs). Use S3 directly for system-generated artifacts (Playwright screenshots, browser traces, large backups).

**Cost estimate:** At 1,000 users with moderate file storage: **~$2-5/month on S3** + included in Supabase Pro.

### Secrets: AWS Secrets Manager + Supabase Vault

| Secret Type | Storage | Cost |
|------------|---------|------|
| OAuth refresh tokens (per-user) | **Supabase Vault** (encrypted column) | Free (included) |
| API keys (OpenAI, Anthropic) | **AWS Secrets Manager** | $0.40/secret/mo |
| Service credentials | **SSM Parameter Store** | Free (standard params) |

**Recommendation:** Store per-user OAuth tokens encrypted in Supabase (using Vault or encrypted JSONB columns). Store shared service secrets (API keys) in AWS Secrets Manager or SSM Parameter Store (free).

---

## 6. Authentication

### Supabase Auth (Recommended)

| Option | Monthly Cost (100K MAU) | Google OAuth | Ops Overhead |
|--------|------------------------|-------------|-------------|
| **Supabase Auth** | **$25/mo** (included in Pro) | Yes, native support | Minimal |
| AWS Cognito | $0 (50K free), then $275 | Yes, native support | Moderate (JWTs, user pools) |
| Auth.js/NextAuth | $0 (self-hosted) | Yes | Self-managed sessions |

**Why Supabase Auth wins:**
1. Already using Supabase for database — auth is included, zero additional cost
2. Google OAuth configured in dashboard — straightforward setup
3. RLS integration — `auth.uid()` in Postgres policies for automatic data isolation
4. Session management built-in — JWT handling, refresh tokens, magic links all included
5. At scale (100K MAU): Supabase ~$630/mo vs Cognito ~$3,180/mo

**Google OAuth Flow:**
```
User clicks "Sign in with Google"
  → Supabase Auth redirects to Google consent screen
  → Google returns auth code
  → Supabase exchanges for access + refresh tokens
  → Supabase stores tokens and creates user session
  → Your app stores Gmail/Calendar OAuth tokens for API access
```

**Important:** You need TWO OAuth scopes:
1. **Authentication scope** (handled by Supabase): `openid`, `email`, `profile`
2. **Gmail/Calendar API scope** (handled separately): `gmail.readonly`, `gmail.send`, `gmail.modify`, `calendar.readonly`

Store the Gmail/Calendar refresh tokens in an encrypted column in Supabase — these are what your agent uses to read/send emails on behalf of the user.

---

## 7. Email Integration

### Inbound: Gmail Push Notifications → AWS Processing Pipeline

```
Gmail Account
  → Gmail Push Notification (via Google Cloud Pub/Sub)
  → Pub/Sub Push Subscription (HTTPS webhook)
  → AWS API Gateway (HTTPS endpoint)
  → SQS Queue (buffer)
  → Lambda Function (email processor)
      → Fetch email via Gmail API (using stored OAuth token)
      → Classify with GPT-4.1 mini
      → Store in Supabase
      → Trigger Step Functions workflow if action needed
      → Notify user via Supabase Realtime
```

**Key implementation details:**
1. Gmail push only sends a `historyId`, not the email content — you must call `history.list` to get the actual messages
2. Gmail watch subscriptions expire after **7 days** — schedule renewal via EventBridge every 6 days
3. Pub/Sub requires a Google Cloud project (free tier is generous: 10GB/month)
4. Consider **idempotency** — Gmail may send duplicate notifications; deduplicate using `gmail_message_id`

### Outbound: SES for Sending (Not Gmail SMTP)

**Why SES over Gmail SMTP for agent-sent emails:**
- Gmail has sending limits (500/day for personal, 2,000/day for Workspace)
- SES: $0.10 per 1,000 emails, no daily limits
- Better deliverability tracking and bounce handling
- Send "from" the user's address using SES verified identities

**However**, for this specific use case where the agent sends emails **as the user** from their Gmail account, you should **use the Gmail API** (`gmail.send`) with the user's OAuth token. This ensures:
- Emails appear in the user's Sent folder
- Thread continuity (same thread ID)
- Proper "from" address without SPF/DKIM issues

**Use SES only for system emails** (briefing summaries, notifications, onboarding).

---

## 8. Deployment & Infrastructure

### SST v3 (Ion) — Recommended

| Tool | Verdict |
|------|---------|
| **SST v3** | **Recommended** — best DX, TypeScript-native, live Lambda debugging, free |
| AWS CDK | Powerful but verbose; SST is built on Pulumi now |
| Terraform | Multi-cloud flexibility you don't need; more complex |
| Amplify | Being sunsetted for Gen 2; too opinionated |
| Serverless Framework | v4 requires paid license for teams |

**Why SST v3:**
- `sst dev` runs Lambda functions locally against real AWS resources (instant feedback loop)
- Type-safe resource bindings (no manual env var management)
- Built-in support for Next.js, ECS, Lambda, SQS, Step Functions, S3
- Free and open source
- Growing community (~200K weekly downloads)

**Infrastructure as Code structure:**
```typescript
// sst.config.ts
export default $config({
  app(input) {
    return { name: "fb-outreach", region: "us-east-1" };
  },
  async run() {
    // Queues
    const emailQueue = new sst.aws.Queue("EmailQueue");
    const browserQueue = new sst.aws.Queue("BrowserQueue");

    // Email processor Lambda
    const emailProcessor = new sst.aws.Function("EmailProcessor", {
      handler: "packages/functions/src/email/process.handler",
      timeout: "5 minutes",
      bind: [emailQueue],
    });
    emailQueue.subscribe(emailProcessor);

    // API on ECS Fargate
    const api = new sst.aws.Cluster("Api", {
      vpc: { /* ... */ },
    });
    api.addService("ApiService", {
      /* ECS task definition */
    });

    // Step Functions for agent workflows
    // (SST supports Step Functions via CDK constructs)

    // S3 for artifacts
    const artifacts = new sst.aws.Bucket("Artifacts");

    // Scheduled tasks via EventBridge
    new sst.aws.Cron("MorningBriefing", {
      schedule: "cron(0 12 * * ? *)", // 7 AM ET in UTC
      function: "packages/functions/src/briefing/morning.handler",
    });
  },
});
```

### CI/CD Pipeline

```
GitHub Push
  → GitHub Actions
  → Run tests (vitest)
  → sst deploy --stage production
  → Post-deploy health checks
```

**Cost:** GitHub Actions free tier (2,000 min/month) is sufficient.

---

## 9. Monitoring & Observability

### CloudWatch + X-Ray (AWS Native)

| Component | Tool | Purpose |
|-----------|------|---------|
| Lambda logs | **CloudWatch Logs** | Function execution logs |
| Agent workflow traces | **X-Ray** | End-to-end distributed tracing |
| Step Functions | **Built-in console** | Visual workflow execution viewer |
| Metrics/alerts | **CloudWatch Alarms** | Error rates, latency, queue depth |
| AI observability | **CloudWatch GenAI Observability** | Token usage, model latency, agent loops |

**Key metrics to monitor:**
- Email processing latency (webhook → classified)
- Agent workflow completion rates
- AI model cost per user per day
- Queue depth (email queue, browser queue)
- Step Functions execution failures
- Gmail API quota usage

**Cost:** CloudWatch Logs ingestion: $0.50/GB. At startup scale: **~$5-10/month**.

**Recommendation:** Start with CloudWatch + X-Ray (included with AWS). Add Datadog or similar only if you need more sophisticated dashboards.

---

## 10. Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js)                            │
│                    Deployed on Vercel/Amplify                       │
└────────────┬───────────────────────────────┬────────────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────┐     ┌─────────────────────────────┐
│    Supabase Auth       │     │    Supabase Realtime         │
│  (Google OAuth)        │     │  (WebSocket notifications)   │
└────────────────────────┘     └─────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Database Layer)                       │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │  PostgreSQL   │  │  pgvector     │  │  Supabase Storage      │  │
│  │  (all tables) │  │  (embeddings) │  │  (user files)          │  │
│  └──────────────┘  └───────────────┘  └────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────┐
│                      AWS (Compute & Orchestration)                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    EVENT PROCESSING                          │   │
│  │                                                              │   │
│  │  Gmail Push → Google Pub/Sub → API Gateway → SQS → Lambda   │   │
│  │              (webhook)                        (buffer) (process) │
│  └──────────────────────────────┬──────────────────────────────┘   │
│                                 │                                   │
│  ┌──────────────────────────────▼──────────────────────────────┐   │
│  │                 ORCHESTRATION (Step Functions)                │   │
│  │                                                              │   │
│  │  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌─────────┐  │   │
│  │  │Classify │ → │Draft     │ → │Wait for   │ → │Send     │  │   │
│  │  │Email    │   │Response  │   │Approval   │   │Email    │  │   │
│  │  └─────────┘   └──────────┘   └───────────┘   └─────────┘  │   │
│  │       │              │                              │        │   │
│  │       ▼              ▼                              ▼        │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  Wait for Response → Check → Loop/Complete           │   │   │
│  │  │  (days/weeks — no compute cost while waiting)        │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐   │
│  │  ECS Fargate         │  │  EventBridge Scheduler             │   │
│  │  (Playwright)        │  │  - Morning briefing (7 AM)         │   │
│  │  On-demand spot      │  │  - Evening wrap-up (6 PM)          │   │
│  │  tasks from SQS      │  │  - Gmail watch renewal (6 days)    │   │
│  └──────────┬──────────┘  │  - One-time follow-up triggers      │   │
│             │              └────────────────────────────────────┘   │
│             ▼                                                       │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐   │
│  │  S3                  │  │  SES                               │   │
│  │  - Screenshots       │  │  - System emails                   │   │
│  │  - Browser traces    │  │  - Briefing summaries              │   │
│  │  - Archived files    │  │                                    │   │
│  └─────────────────────┘  └────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  AI Model APIs (Direct)                                      │   │
│  │  - OpenAI GPT-4.1 mini (classification, summaries)           │   │
│  │  - Anthropic Claude Sonnet (email drafting)                  │   │
│  │  - Claude Opus (complex reasoning, when needed)              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Monitoring: CloudWatch Logs + X-Ray + GenAI Observability   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 11. Cost Estimates

### At 100 Users (~5,000 emails/day)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Supabase Pro | $25 | DB, auth, realtime, storage |
| ECS Fargate (API) | $10 | 0.25 vCPU, always-on |
| Lambda | $0 | Well within free tier |
| Step Functions | $0.50 | ~1,000 active workflows |
| SQS | $0 | Free tier |
| EventBridge | $0 | Free tier |
| S3 | $2 | Screenshots, artifacts |
| SES | $0.50 | System emails |
| CloudWatch | $5 | Logs + metrics |
| Secrets Manager | $2 | 5 secrets |
| AI APIs (OpenAI + Anthropic) | **$60-100** | Largest variable cost |
| NAT Gateway | $32 | Required for VPC Lambda/ECS |
| **TOTAL** | **~$137-177/mo** | |

### At 1,000 Users (~50,000 emails/day)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Supabase Pro | $25 | May need compute add-on (+$25) |
| ECS Fargate (API) | $20 | Scale to 0.5 vCPU |
| ECS Fargate (Playwright) | $5 | On-demand tasks |
| Lambda | $5 | Beyond free tier |
| Step Functions | $5 | ~10,000 active workflows |
| SQS | $2 | Beyond free tier |
| EventBridge | $0 | Still free tier |
| S3 | $10 | More artifacts |
| SES | $5 | More system emails |
| CloudWatch | $15 | More logs |
| Secrets Manager | $2 | Same secrets |
| AI APIs (OpenAI + Anthropic) | **$600-800** | Scales linearly with emails |
| NAT Gateway | $45 | More data transfer |
| **TOTAL** | **~$740-960/mo** | |

### Critical Cost Insight

**AI API calls are 70-80% of your total cost.** Optimize here first:
1. Use GPT-4.1 mini (not Sonnet) for classification tasks — 10x cheaper
2. Cache common classifications (e.g., "newsletter" → auto-archive)
3. Batch similar emails for bulk processing
4. Use embeddings for deduplication before sending to LLMs
5. Implement tiered processing — only escalate to expensive models when needed

### NAT Gateway Warning

NAT Gateway is the biggest "surprise cost" on AWS. At $32/month minimum + $0.045/GB data processing, it can easily be your second-largest line item. Mitigation:
- Use VPC endpoints for AWS services (S3, DynamoDB, SQS) — eliminates NAT for AWS traffic
- Consider running Lambda outside VPC for functions that don't need private resources
- Use Supabase's public API (no VPC needed) for database access from Lambda

---

## 12. Serverless vs Always-On Trade-offs

| Factor | Serverless (Lambda-heavy) | Always-On (ECS-heavy) |
|--------|--------------------------|----------------------|
| **Cost at low traffic** | Near-zero (free tiers) | ~$10-20/mo minimum |
| **Cost at high traffic** | Scales linearly, can get expensive | More predictable, potentially cheaper |
| **Cold starts** | 100ms-3s depending on runtime | None |
| **WebSockets** | Not supported | Supported |
| **Max execution time** | 15 minutes | Unlimited |
| **Operational overhead** | Minimal | Container management |
| **Debugging** | CloudWatch logs (harder) | SSH/exec into container |

**Recommended hybrid approach:**
- **Always-on ECS Fargate:** API server (needs WebSockets, persistent connections)
- **Serverless Lambda:** Email processing, agent steps, scheduled tasks
- **On-demand ECS Fargate:** Playwright browser automation (spin up per task)
- **Step Functions:** Workflow orchestration (serverless, no compute cost while waiting)

---

## 13. Hybrid Supabase + AWS: Why It Makes Sense

### What Supabase Handles Better
| Capability | Supabase Approach | AWS-Native Approach | Winner |
|-----------|------------------|-------------------|--------|
| Auth + Google OAuth | Dashboard config, $0 extra | Cognito user pools, JWT config | Supabase |
| PostgreSQL database | Managed, includes extensions | RDS/Aurora, more config needed | Supabase |
| Realtime notifications | Built-in WebSocket channels | AppSync + DynamoDB Streams | Supabase |
| File storage (user-facing) | S3-compatible with CDN | S3 + CloudFront config | Supabase |
| Vector search | pgvector included | OpenSearch or Bedrock KB | Supabase |
| Row-Level Security | Native Postgres RLS | IAM + custom middleware | Supabase |
| Dashboard / SQL editor | Included | None (use pgAdmin) | Supabase |

### What AWS Handles Better
| Capability | AWS Approach | Supabase Alternative | Winner |
|-----------|-------------|---------------------|--------|
| Long-running workflows | Step Functions (1-year max) | Edge Functions (150s max) | AWS |
| Browser automation | ECS Fargate (any container) | Not possible | AWS |
| Complex event routing | EventBridge + SQS + SNS | Webhooks (limited) | AWS |
| Scheduled tasks | EventBridge Scheduler | pg_cron (basic) | AWS |
| Email sending | SES ($0.10/1K) | Not a feature | AWS |
| Container workloads | ECS/Fargate | Not possible | AWS |
| AI observability | CloudWatch GenAI + X-Ray | Not a feature | AWS |

### Integration Pattern

The two systems communicate via:
1. **Lambda → Supabase:** Lambda functions call Supabase REST API or use the `@supabase/supabase-js` client with a service role key
2. **Supabase → AWS:** Supabase Database Webhooks trigger API Gateway endpoints, or Supabase Edge Functions call AWS APIs
3. **Shared auth:** Supabase JWT tokens can be verified in AWS Lambda using the Supabase JWT secret

---

## 14. Implementation Priority / Build Order

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Supabase project (database schema, auth, RLS policies)
- [ ] Set up SST v3 project with Lambda and S3
- [ ] Implement Google OAuth flow (Supabase Auth + Gmail/Calendar scopes)
- [ ] Basic email fetching via Gmail API

### Phase 2: Email Pipeline (Week 3-4)
- [ ] Gmail push notifications setup (Google Pub/Sub → API Gateway → SQS → Lambda)
- [ ] Email classification with GPT-4.1 mini
- [ ] Store processed emails in Supabase
- [ ] Basic Supabase Realtime notifications to frontend

### Phase 3: Agent Workflows (Week 5-7)
- [ ] Step Functions workflow definitions (follow-up sequences)
- [ ] Draft generation with Claude Sonnet
- [ ] Human-in-the-loop approval flow
- [ ] Email sending via Gmail API
- [ ] EventBridge scheduling (briefings, follow-up timing)

### Phase 4: Browser Automation (Week 8-9)
- [ ] Playwright Docker container for ECS Fargate
- [ ] SQS → ECS task triggering
- [ ] Screenshot/trace storage in S3

### Phase 5: Polish & Scale (Week 10+)
- [ ] Morning/evening briefing generation
- [ ] Contact relationship scoring and semantic search (pgvector)
- [ ] CloudWatch dashboards and alerting
- [ ] Cost optimization (caching, model routing)
- [ ] Load testing and scaling verification

---

## 15. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gmail API rate limits (250 quota units/user/sec) | Email processing delays | Implement backoff, SQS buffering, batch API calls |
| AI API costs exceeding budget | Financial | Aggressive caching, model tiering, usage caps per user |
| Step Functions state size limit (256KB) | Large workflow state fails | Store large payloads in S3/Supabase, pass references |
| NAT Gateway costs | Unexpected bills | VPC endpoints, minimize VPC-bound functions |
| Supabase connection limits (Pro: 60 direct) | DB connection exhaustion | Use connection pooler (Supavisor), service role for Lambda |
| Gmail push notification reliability | Missed emails | Periodic polling fallback every 5 minutes |
| OAuth token expiry | Agent stops working | Store refresh tokens, implement auto-refresh, alert on failures |

---

## 16. Final Recommendation Summary

```
DATABASE + AUTH + REALTIME → Supabase ($25/mo)
COMPUTE (API)              → ECS Fargate ($10-20/mo)
COMPUTE (async)            → AWS Lambda (free tier)
COMPUTE (browser)          → ECS Fargate spot tasks ($2-5/mo)
ORCHESTRATION              → AWS Step Functions ($0.50-5/mo)
QUEUING                    → Amazon SQS (free tier)
SCHEDULING                 → EventBridge Scheduler (free tier)
AI MODELS                  → Direct OpenAI + Anthropic APIs ($60-800/mo)
EMAIL SENDING              → Gmail API (as user) + SES (system)
FILE STORAGE               → S3 + Supabase Storage ($2-10/mo)
SECRETS                    → Supabase Vault + SSM Parameter Store (free)
MONITORING                 → CloudWatch + X-Ray ($5-15/mo)
DEPLOYMENT                 → SST v3 + GitHub Actions (free)
```

**Total estimated cost:** $137-177/mo at 100 users → $740-960/mo at 1,000 users

The hybrid approach gives you the best of both worlds: Supabase's incredible developer experience and integrated services for the data layer, combined with AWS's unmatched compute, orchestration, and scaling capabilities for the agentic workloads that Supabase can't handle.
