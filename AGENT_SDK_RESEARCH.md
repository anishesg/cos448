# AI Agent SDKs & Frameworks: Deep Research (April 2026)

> Comprehensive comparison for building a business-ops agent (email triage, follow-up loops, browser automation) as a startup MVP.

---

## 1. Framework-by-Framework Analysis

### 1.1 Vercel AI SDK (v4+)

| Dimension | Details |
|-----------|---------|
| **Language** | TypeScript-first |
| **Maturity** | 2.8M weekly npm downloads; production-proven at scale |
| **License** | Apache 2.0 |

**Key Agent Features:**
- **ToolLoopAgent** — reusable agent class for multi-step reasoning-and-action loops. Iteratively invokes tools, collects results, decides next action until completion.
- **createAgentUIStream()** — streams agent output as UI message chunks via async iterables for real-time rendering.
- **Loop Control** — configurable stopping: `stepCountIs()`, `hasToolCall()`, `isLoopFinished()`, custom conditions, composable combinators. Default safety limit: 20 steps.
- **prepareStep** — mutate agent settings between steps (switch models, adjust temperature, etc.)
- **Provider-agnostic** — OpenAI, Anthropic, Google Gemini, Mistral, and dozens more via unified interface.

**Streaming:** Best-in-class. `streamText()`, `streamObject()`, `createAgentUIStream()`. Native React hooks (`useChat`, `useCompletion`) for instant UI integration.

**Tool Calling:** Zod-validated tool schemas. Tool choice: `auto`, `required`, `none`, or force-specific. Sequential execution based on model decisions.

**State Management:** Basic — step callbacks (`onStepFinish`, `onFinish`). **WorkflowAgent** (`@ai-sdk/workflow`) is in active development for v7.0 with durable state persistence, model serialization across step boundaries, and checkpoint recovery. Not yet GA.

**Verdict for Business-Ops Agent:** Excellent for the AI layer and UI streaming. Lacks built-in durable workflow persistence today — you'd need to pair it with an external state manager (database, Inngest, Trigger.dev) for long-running follow-up loops. Best if you're already in Next.js.

---

### 1.2 LangChain / LangGraph

| Dimension | Details |
|-----------|---------|
| **Language** | Python-first; TypeScript SDK available (lags 2-3 releases) |
| **Maturity** | 48K GitHub stars; production use at Klarna, Uber, LinkedIn, Elastic, Replit |
| **License** | MIT |

**Key Agent Features:**
- **Graph-based orchestration** — models workflows as directed cyclic graphs. Nodes = actions, edges = conditional transitions. Supports loops, parallel branches, indefinite pauses.
- **LangGraph 2.0** (Feb 2026) — typed persistent state schemas, durable execution with checkpoint recovery, first-class type safety, human-in-the-loop interrupts, multi-agent subgraphs.
- **Time-Travel Debugging** — replay and inspect any prior state.
- **Checkpoint persistence** — Postgres, Redis, SQLite backends.

**Streaming:** Supported but less ergonomic than Vercel AI SDK for frontend streaming. Better suited for backend agent loops.

**Tool Calling:** Full support via LangChain tool abstractions. Extensive pre-built tool integrations.

**State Management:** **Best-in-class.** Typed state dictionaries with checkpoint persistence. Automatic crash recovery. Pause/resume for human-in-the-loop. This is LangGraph's core value proposition.

**Verdict for Business-Ops Agent:** The strongest choice for complex, long-running workflows (email follow-up loops, multi-day sequences). The graph model maps naturally to business process state machines. However, the TypeScript SDK lags Python, and the abstraction is verbose for simpler use cases.

---

### 1.3 OpenAI Agents SDK

| Dimension | Details |
|-----------|---------|
| **Language** | Python and TypeScript (v0.8.3, April 2026) |
| **Maturity** | Backed by OpenAI; relatively new (early 2025 launch) |
| **License** | MIT |

**Key Agent Features:**
- **Minimal primitives** — agents, tools, handoffs, guardrails. Intentionally lightweight.
- **Handoffs** — agents delegate to specialist agents with customizable input payloads, history filtering, and conditional enabling.
- **Guardrails** — input, output, and tool-level validation. Parallel or sequential execution modes.
- **Sessions** — persistent memory layer for conversation context.
- **Tracing** — built-in observability for debugging agent flows.
- **MCP integration** — native Model Context Protocol support for tool calling.
- **Realtime agents** — voice agent support.

**Streaming:** Supported via `Runner.runStreamed()`.

**Tool Calling:** Function tools with automatic schema generation from Zod. MCP server integration for external tool providers.

**State Management:** Sessions provide conversation persistence. No built-in durable workflow engine — the SDK handles single agent runs, not multi-day state machines.

**Verdict for Business-Ops Agent:** Good for single-agent interactions with clean handoff patterns. The guardrails system is production-ready. However, it's OpenAI-locked (no provider agnosticism) and lacks the workflow persistence needed for long-running follow-up loops. Best as a complement, not the primary orchestration layer.

---

### 1.4 Anthropic Claude API / Agent SDK

| Dimension | Details |
|-----------|---------|
| **Language** | Python and TypeScript |
| **Maturity** | Claude is the leading coding/reasoning model; SDK is newer |
| **License** | Proprietary API; Agent SDK open source |

**Key Agent Features:**
- **Rich tool ecosystem** — client tools (bash, text_editor, computer, memory) and server tools (web_search, code_execution, web_fetch).
- **Computer Use** (Beta) — GUI-level browser/desktop automation via screenshots and mouse/keyboard actions.
- **Agent SDK** (formerly Claude Code SDK) — autonomous agents with built-in file reading, command execution, web search, code editing.
- **MCP Connector** — server-executed MCP toolset integration.
- **Memory tool** — client-executed persistent memory.
- **Advisor tool** (Beta, March 2026) — agent-to-agent consultation.

**Streaming:** Full streaming support via the Messages API.

**Tool Calling:** Most mature tool-use implementation. Dated versioned tools (`web_search_20260209`, etc.). Both client-executed and server-executed models.

**State Management:** No built-in workflow persistence. The API is stateless per request — you manage state externally.

**Verdict for Business-Ops Agent:** Claude's Computer Use is uniquely valuable for browser automation. The tool ecosystem is the richest. However, the Agent SDK is Anthropic-locked. Best used as the **model layer** (via Vercel AI SDK or similar) rather than the orchestration layer.

---

### 1.5 CrewAI

| Dimension | Details |
|-----------|---------|
| **Language** | Python-only |
| **Maturity** | 450M agents/month; 60% of US Fortune 500; massive adoption |
| **License** | MIT |

**Key Agent Features:**
- **Role-based agents** — agents with defined roles, goals, and backstories collaborate as "crews."
- **Process models** — sequential and hierarchical execution patterns.
- **CrewAI Flows** — event-driven orchestration with `@start`, `@listen`, `@router` decorators for state persistence, conditional routing, error recovery.
- **Memory systems** — short-term, long-term, and entity memory architectures.
- **CrewAI Studio** — visual drag-and-drop workflow builder.
- **100+ built-in tools** — extensive integration library.

**Streaming:** Limited compared to Vercel AI SDK.

**Tool Calling:** `@tool` decorator for custom tools. 100+ pre-built integrations.

**State Management:** CrewAI Flows handles state persistence and conditional routing. Less granular than LangGraph but more ergonomic.

**Verdict for Business-Ops Agent:** Strong multi-agent orchestration for Python teams. The role-based paradigm maps well to business ops (email agent, calendar agent, follow-up agent). However, Python-only is a limitation for TypeScript/Next.js stacks. Documentation can lag features. Memory management becomes inconsistent at scale.

---

### 1.6 Mastra

| Dimension | Details |
|-----------|---------|
| **Language** | TypeScript-native (not ported from Python) |
| **Maturity** | 22K GitHub stars; 300K weekly npm downloads; $13M seed funding; early GA |
| **License** | Apache 2.0 |

**Key Agent Features:**
- **Agents + Workflows** — autonomous agents for open-ended tasks + deterministic workflows with `.then()`, `.branch()`, `.parallel()`.
- **Supervisor agents** — split complex work across specialized agents.
- **Memory** — persistent conversation history, semantic recall, working memory, observational memory (condenses conversations into dense observations).
- **40+ LLM providers** — OpenAI, Anthropic, Gemini, etc. via one interface.
- **Full MCP support** — tool definitions with Zod schemas shared across agents.
- **Human-in-the-loop** — suspend/resume execution for approvals.
- **Mastra Studio** — local IDE for testing, debugging, collaboration.
- **Built-in evals** — model-graded, rule-based, statistical evaluation framework.
- **Guardrails** — prompt injection prevention, response sanitization.

**Streaming:** Supported across all agent types.

**Tool Calling:** Zod-schema tools shared via MCP. Tool approval for human/system gates.

**State Management:** Workflow primitives (`.then()`, `.branch()`, `.parallel()`) with state persistence. More structured than Vercel AI SDK, less graph-centric than LangGraph.

**Verdict for Business-Ops Agent:** The most compelling "batteries-included" TypeScript framework. Agents, workflows, memory, evals, and a dev studio in one package. Early GA means some rough edges, but the trajectory is strong. The "Next.js of AI agents" positioning makes it ideal for fast-moving startup MVPs.

---

## 2. Head-to-Head Comparison Matrix

| Feature | Vercel AI SDK | LangGraph | OpenAI Agents SDK | Claude API/SDK | CrewAI | Mastra |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| **TypeScript Native** | ★★★ | ★★ | ★★★ | ★★☆ | ✗ | ★★★ |
| **Streaming** | ★★★ | ★★ | ★★☆ | ★★★ | ★☆ | ★★☆ |
| **Tool Calling** | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ |
| **Multi-Step Agents** | ★★★ | ★★★ | ★★☆ | ★★☆ | ★★★ | ★★★ |
| **State Persistence** | ★☆ | ★★★ | ★☆ | ✗ | ★★ | ★★ |
| **Durable Workflows** | ★☆ (WIP) | ★★★ | ✗ | ✗ | ★★ | ★★ |
| **Multi-Agent** | ★☆ | ★★★ | ★★ | ★☆ | ★★★ | ★★ |
| **Provider Agnostic** | ★★★ | ★★★ | ✗ (OpenAI only) | ✗ (Anthropic only) | ★★★ | ★★★ |
| **Memory Built-in** | ✗ | ★☆ | ★☆ | ★☆ | ★★ | ★★★ |
| **Human-in-the-Loop** | ★☆ | ★★★ | ★★ | ✗ | ★☆ | ★★ |
| **Dev Tooling** | ★★ | ★★ (LangSmith) | ★★ (tracing) | ✗ | ★★★ (Studio) | ★★★ (Studio) |
| **Community Size** | 2.8M dl/wk | 529K dl/wk | Growing | Massive (API) | Huge (Python) | 300K dl/wk |
| **Production-Ready** | ★★★ | ★★★ | ★★ | ★★★ (API) | ★★★ | ★★ (early GA) |
| **Browser Automation** | ✗ | ✗ | ✗ | ★★★ (Computer Use) | ✗ | ✗ |

---

## 3. State Machines for Agent Workflows

### LangGraph (Recommended for Complex Workflows)
- Purpose-built for AI agent state machines with directed cyclic graphs.
- Typed state dictionaries, checkpoint persistence (Postgres/Redis), crash recovery.
- Human-in-the-loop interrupts, time-travel debugging.
- **Best for:** Multi-day follow-up loops, conditional branching, retry logic, parallel execution.

### XState
- General-purpose finite state machine library for JavaScript/TypeScript.
- Excellent for UI state management and deterministic workflows.
- **Not recommended for AI agents** — lacks AI-specific features (checkpoint persistence for LLM state, token management, tool execution patterns). You'd be rebuilding what LangGraph already provides.

### Custom State Machines (with Inngest/Trigger.dev)
- For simpler workflows, a custom state machine backed by a durable execution engine (Inngest, Trigger.dev, Temporal) can be lighter-weight.
- **Best for:** Linear or lightly branching workflows where LangGraph's graph abstraction is overkill.
- Temporal is the enterprise choice for mission-critical durable workflows but has high operational complexity.

### Recommendation
**For your business-ops MVP:** Start with Mastra's workflow primitives (`.then()`, `.branch()`, `.parallel()`) or Vercel AI SDK's agent loops for the simple paths. If follow-up loop complexity grows (conditional branching based on email responses, multi-day pauses, retry logic), adopt LangGraph.js for those specific workflows. Avoid XState for agent orchestration.

---

## 4. Agent Memory: Best Practices

### The 2026 Consensus: Hybrid Architectures

No single storage paradigm dominates. Production agents need:

| Memory Type | Storage | Use Case |
|-------------|---------|----------|
| **Working State** | SQL (Postgres) | User profiles, conversation history, task queues, entity relationships, audit logs. ACID guarantees for transactional reliability. |
| **Semantic Recall** | Vector DB (pgvector, Pinecone) | Knowledge base retrieval, context augmentation, few-shot examples. Fuzzy similarity search. |
| **Temporal Knowledge** | Knowledge Graph | How facts change over time. Relationship evolution. |

### Leading Memory Frameworks (2026 Benchmarks)

| Framework | Architecture | LoCoMo Score | Best For |
|-----------|-------------|:---:|---------|
| **Zep/Graphiti** | Temporal knowledge graph | ~85% | Compliance-heavy workflows, temporal reasoning, complex agent patterns |
| **Letta/MemGPT** | Three-tier (core/recall/archival) | ~83% | Long-running agents with self-editing memory |
| **Mem0** | Vector + knowledge graph | ~58% | General-purpose agent personalization, bolt-on to existing agents |

### Recommendation for Business-Ops Agent

**Start simple, evolve:**
1. **Phase 1 (MVP):** Use Postgres for structured state (email thread status, follow-up schedules, contact profiles). Use the framework's built-in memory (Mastra's persistent memory or Vercel AI SDK's conversation context).
2. **Phase 2:** Add pgvector for semantic search over past emails and meeting notes.
3. **Phase 3:** If temporal reasoning becomes critical (e.g., "What changed in this deal since last week?"), integrate Zep/Graphiti.

Avoid over-engineering memory at MVP stage. Postgres + pgvector covers 90% of startup needs.

---

## 5. Gmail API & Google Calendar Integration

### Gmail API (Node.js/TypeScript)

**Official Library:**
```bash
npm install googleapis
```

**Key Patterns:**
- OAuth 2.0 authentication via Google Cloud Console.
- `gmail.users.threads.get()` for full thread retrieval with message history.
- `gmail.users.messages.list()` with query filters for inbox triage.
- `gmail.users.messages.send()` for sending replies within threads.
- Watch API + Pub/Sub for real-time inbox change notifications.

**Email Parsing:**
- **postal-mime** (2.3M weekly downloads, v2.7.4) — zero-dependency RFC 5322 parser. Decodes raw MIME into structured objects with TypeScript support. Best for parsing Gmail API raw message format.
- **@dubdubdublabs/gmailer** — purpose-built for parsing Gmail API message payloads. Traverses the payload tree for subject, body (text + HTML), attachments, thread IDs.

**Thread Management:**
- Gmail threads are identified by `threadId` — all messages in a conversation share the same ID.
- Use `In-Reply-To` and `References` headers when sending replies to maintain thread integrity.
- Label management (`INBOX`, `UNREAD`, custom labels) for triage state tracking.

### Google Calendar API (TypeScript)

**Official Library:**
```bash
npm install @googleapis/calendar   # v14.2.0
```

**Key Operations:**
- `calendar.events.list()` — fetch events with time range filters.
- `calendar.events.insert()` — create new events.
- `calendar.events.patch()` — update existing events.
- `calendar.freebusy.query()` — check availability across calendars.
- Watch API for real-time event change notifications.

**Auth:** Same OAuth 2.0 flow as Gmail. Request both `gmail.modify` and `calendar.events` scopes together.

### Integration Architecture for Agent

```
Gmail Watch (Pub/Sub) → Webhook → Agent Trigger
  ├─ Parse email (postal-mime)
  ├─ Classify intent (LLM)
  ├─ Check calendar (freebusy)
  ├─ Draft response (LLM)
  └─ Send reply / Schedule follow-up
```

---

## 6. Browser Automation for Agents

### Approaches (2026)

| Tool | Approach | Reliability | Cost/Action |
|------|----------|:-----------:|:-----------:|
| **Playwright MCP** | Accessibility-tree snapshots (2-5KB vs 100KB screenshots) | 99%+ (deterministic) | ~$0 |
| **Stagehand** (Browserbase) | Plain-English task descriptions, TypeScript API | 85-95% | $0.003-0.01 |
| **Claude Computer Use** | Screenshot + mouse/keyboard GUI automation | 80-90% | $0.01-0.05 |
| **Browser-Use** | Python-first agentic browser automation (35K stars) | 85-95% | $0.003-0.01 |
| **Playwright CLI** | Token-efficient commands for coding agents | 99%+ (deterministic) | ~$0 |

### Recommendation
**For production reliability:** Use **Playwright MCP** (`@playwright/mcp`) for structured browser tasks. The accessibility-tree approach is 20-50x more token-efficient than screenshot-based methods and deterministically reliable.

**For flexible exploration:** Use **Stagehand** or **Claude Computer Use** for tasks where the page structure is unknown or frequently changing.

**Hybrid approach:** Deterministic Playwright scripts for known workflows (e.g., CRM updates) + AI-driven automation (Stagehand/Computer Use) for novel pages.

---

## 7. Recommended Architecture for Startup MVP

### The Stack

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│         Next.js + Vercel AI SDK (streaming)      │
│         useChat / createAgentUIStream            │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              Agent Orchestration                  │
│                                                   │
│  Option A: Mastra (batteries-included)            │
│    - Agents, workflows, memory, evals, studio     │
│    - Best for fast MVP iteration                  │
│                                                   │
│  Option B: Vercel AI SDK + Inngest/Trigger.dev    │
│    - AI SDK for agent loops + streaming           │
│    - Inngest for durable workflow scheduling       │
│    - More control, more assembly required          │
│                                                   │
│  Option C: LangGraph.js (if workflows are complex)│
│    - Graph-based state machines                    │
│    - Best state persistence and recovery           │
│    - More verbose, steeper learning curve          │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                  Model Layer                      │
│  Claude 3.5/4 (reasoning, tool use)               │
│  GPT-4o (speed, function calling)                 │
│  Gemini 2.5 (long context, cost efficiency)       │
│  Route via Vercel AI SDK or Mastra's provider API │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                 Integrations                      │
│  Gmail API (googleapis) + postal-mime             │
│  Google Calendar API (@googleapis/calendar)       │
│  Playwright MCP (browser automation)              │
│  Supabase (Postgres + pgvector + auth + realtime) │
└───────────────────────────────────────────────────┘
```

### Recommended Path: **Option A (Mastra) for MVP**

**Why Mastra for your use case:**
1. **TypeScript-native** — no Python/JS impedance mismatch.
2. **Agents + Workflows in one framework** — don't need to stitch together 3 libraries.
3. **Built-in memory** — conversation history, semantic recall, working memory.
4. **MCP support** — expose Gmail, Calendar, Browser tools as MCP servers that any agent can call.
5. **Human-in-the-loop** — suspend execution for user approval on sensitive emails.
6. **Mastra Studio** — local dev playground for testing agent behavior.
7. **Provider agnostic** — swap models without code changes.
8. **300K weekly downloads, $13M funding** — enough traction to bet on for an MVP.

**Augment with:**
- **Vercel AI SDK** for the frontend streaming layer (it complements Mastra, not competes).
- **Supabase** for Postgres + pgvector + auth + realtime subscriptions.
- **Inngest** for durable scheduling (follow-up emails in 3 days, etc.) if Mastra's workflows don't cover it.
- **Playwright MCP** for browser automation tasks.

### When to Switch to LangGraph

Adopt LangGraph.js if you hit any of these:
- Workflows with 5+ conditional branches and loops.
- Need to pause workflows for days and resume reliably.
- Complex error recovery with retry strategies.
- Multi-agent coordination with shared mutable state.
- Regulatory requirements for full audit trails of agent decisions.

---

## 8. Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Mastra is early GA | Keep agent logic in thin wrapper functions that can port to another framework. Avoid deep coupling to Mastra-specific APIs. |
| LangGraph.js lags Python | Monitor release cadence. Have LangGraph Python as fallback for critical workflows. |
| Gmail API rate limits | Implement exponential backoff. Use batch API for bulk operations. Cache thread data in Postgres. |
| Browser automation reliability | Use deterministic Playwright for known pages. Reserve AI automation for exploration only. |
| Memory complexity creep | Start with Postgres. Add pgvector only when you have a concrete semantic search need. Avoid Zep/Mem0 until Phase 2+. |
| Model vendor lock-in | Use provider-agnostic SDK (Vercel AI SDK or Mastra). Abstract model calls behind an interface. |

---

## 9. TL;DR Decision Matrix

| If you need... | Choose |
|---------------|--------|
| Fastest TypeScript MVP with agents + workflows + memory | **Mastra** |
| Best frontend streaming + React integration | **Vercel AI SDK** |
| Most robust long-running workflow state machines | **LangGraph.js** |
| Simplest agent loop with clean abstractions | **OpenAI Agents SDK** |
| Best tool use and browser automation model | **Claude API** (as model, not framework) |
| Python multi-agent teams with roles | **CrewAI** |
| Production email/calendar integration | **googleapis** + **postal-mime** |
| Reliable browser automation | **Playwright MCP** |
| Agent memory (start simple) | **Postgres + pgvector** |
| Agent memory (advanced) | **Zep** (temporal) or **Mem0** (bolt-on) |

---

*Research compiled April 15, 2026. Framework versions and features change rapidly — verify against official docs before implementation.*
