# Playwright Browser Automation for Production Agentic Applications (2026)

> Deep research compiled April 2026

---

## Table of Contents

1. [Playwright MCP / AI Integration](#1-playwright-mcp--ai-integration)
2. [Production Deployment](#2-production-deployment)
3. [Reliability Patterns](#3-reliability-patterns)
4. [Security](#4-security)
5. [Specific Use Cases](#5-specific-use-cases)
6. [Alternatives & Complements](#6-alternatives--complements)
7. [Tiered Architecture Recommendation](#7-tiered-architecture-recommendation)
8. [Cost Analysis](#8-cost-analysis)

---

## 1. Playwright MCP / AI Integration

### 1.1 Playwright MCP Server

**Current state:** v0.0.70 (April 2026), 60 releases, 70 contributors. Now has first-class documentation at `playwright.dev/mcp`.

**What it offers — Core Tools (always enabled):**

| Category | Tools |
|----------|-------|
| Navigation | `browser_navigate`, `browser_navigate_back` |
| Snapshots | `browser_snapshot` (accessibility tree), `browser_take_screenshot` |
| Interaction | `browser_click`, `browser_hover`, `browser_drag`, `browser_select_option`, `browser_type`, `browser_press_key`, `browser_fill_form` |
| Advanced | `browser_run_code`, `browser_wait_for`, `browser_evaluate`, `browser_handle_dialog`, `browser_file_upload` |
| Monitoring | `browser_console_messages`, `browser_network_requests` |
| Tabs | `browser_tabs`, `browser_close`, `browser_resize` |

**Optional capabilities (enabled via `--caps` flag):**

| Capability | Tools | Use Case |
|------------|-------|----------|
| `vision` | `browser_mouse_move_xy`, `browser_mouse_click_xy`, `browser_mouse_drag_xy`, `browser_mouse_wheel` | Canvas apps, custom widgets without ARIA |
| `network` | `browser_route`, `browser_route_list`, `browser_unroute`, `browser_network_state_set` | Request mocking, network interception |
| `storage` | `browser_cookie_*`, `browser_localstorage_*`, `browser_sessionstorage_*`, `browser_storage_state`, `browser_set_storage_state` | Session management, cookie manipulation |
| `testing` | `browser_verify_element_visible`, `browser_verify_text_visible`, `browser_verify_list_visible`, `browser_verify_value`, `browser_generate_locator` | Assertions and validation |
| `pdf` | PDF generation | Document generation |

**Installation:**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### 1.2 Accessibility Snapshots vs Screenshots

This is the most important architectural decision for AI-driven browser automation.

**Accessibility Snapshots (Default — Recommended for interactions):**
- Structured text from the browser's accessibility tree: roles, labels, states, refs
- **Token cost: ~200–5,000 tokens per page** (5KB–50KB)
- Deterministic element references (no coordinate guessing)
- Works with any LLM (no vision model required)
- 10x–100x more token-efficient than screenshots
- ~$0.15 per page interaction with a frontier model

**Screenshots (Vision mode):**
- Pixel-based visual data requiring vision-capable models
- **Token cost: ~10,000–50,000 tokens per page**
- Required for: canvas/WebGL apps, custom widgets without ARIA, visual layout verification
- ~$0.001 per page for read-only analysis
- Coordinate-based interactions are less reliable

**Recommendation: Hybrid approach**
1. Use accessibility snapshots for all interactive workflows (forms, clicks, navigation)
2. Use screenshots for visual verification, layout checks, and read-only monitoring
3. For complex pages: screenshot first to understand layout ($0.001), then switch to accessibility tree for interactions ($0.15), then verify with screenshot

### 1.3 AI Integration Patterns

**Pattern A: MCP-native (simplest)**
- LLM connects to Playwright MCP server directly
- LLM sees accessibility snapshots, decides which tools to call
- Best for: development workflows, Cursor/Claude Desktop integration
- Limitation: coupled to MCP client runtime

**Pattern B: Programmatic with LLM orchestration**
- Your application code manages Playwright browser instances
- LLM receives page state (snapshot or screenshot) and returns structured actions
- You execute actions via Playwright API
- Best for: production applications with custom logic

**Pattern C: Hybrid deterministic + AI (recommended for production)**
- Deterministic Playwright scripts handle known flows
- AI invoked selectively for dynamic elements (Stagehand's `act`/`extract`/`observe`)
- Best for: reliable production systems that need to handle variation

---

## 2. Production Deployment

### 2.1 Docker Containers

**Official images:** `mcr.microsoft.com/playwright` (recommended base)

**Dockerfile best practices:**
```dockerfile
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Run as non-root
RUN adduser --disabled-password appuser
USER appuser

CMD ["node", "index.js"]
```

**Key optimizations:**
- Multi-stage builds to minimize image size
- Install only the browser you need (`npx playwright install chromium`)
- For cross-platform (M1 Mac → AMD64): `docker buildx build --platform=linux/amd64`
- Chromium args: `--disable-gpu`, `--no-sandbox` (containers only), `--disable-dev-shm-usage`, `--disable-extensions`

**Resource per container:**
- Minimum: 1 vCPU, 1GB RAM (tight)
- Recommended: 2 vCPU, 2GB RAM per concurrent browser
- Idle headless Chromium: ~700MB peak memory
- Each additional browser context: ~50–150MB incremental

### 2.2 AWS Deployment Options

#### ECS Fargate (Recommended for production)

**Pros:**
- No time limit (unlike Lambda's 15-min cap)
- Native Docker support
- Auto-scaling with target tracking
- Good cost/control balance

**Architecture:**
1. ECR repository for Playwright Docker images
2. ECS task definition with 2 vCPU / 4GB memory per task
3. Fargate launch type (no EC2 management)
4. CloudWatch for logs and monitoring
5. S3 for screenshots, traces, and artifacts
6. Secrets Manager for credentials

**Task role permissions:**
- ECR pull access
- S3 write for artifacts
- Secrets Manager read
- CloudWatch Logs write

#### AWS Lambda

**Viable for:** Short, simple automations (< 5 minutes)

**Limitations:**
- 15-minute maximum timeout
- Minimum 1024MB memory required (2048MB+ recommended)
- 10GB container image size limit
- Cold starts add 5–15 seconds
- Browser binaries need Lambda-compatible builds

**Setup options:**
- Lambda Layers with `playwright-aws-lambda` package
- Container images (more reliable) using official Playwright Docker images

**Not recommended for:** Complex multi-page flows, long-running sessions, or high-concurrency workloads.

#### ECS on EC2 (Cost optimization at scale)

For high-volume workloads, EC2 with Spot instances can be 60–70% cheaper than Fargate. Use when running 50+ concurrent browsers consistently.

### 2.3 Managed Browser Services

#### Browserless.io

| Plan | Price/mo | Concurrent Browsers | Units/mo | Overage |
|------|----------|---------------------|----------|---------|
| Free | $0 | 2 | 1,000 | — |
| Prototyping | $25 | 15 | 20,000 | $0.0020/unit |
| Starter | $140 | 50 | 180,000 | $0.0018/unit |
| Scale | $350 | 120 | 500,000 | $0.0015/unit |
| Enterprise | Custom | Hundreds+ | Millions | Negotiated |

1 unit = up to 30 seconds of browser connection time.

**Features:** Stealth mode, CAPTCHA solving, session replay, browser extensions, regional load balancing, persistent sessions.

#### Browserbase

| Plan | Price/mo | Browser Hours | Overage |
|------|----------|---------------|---------|
| Free | $0 | 1 hr | — |
| Developer | $20 | 100 hrs | $0.12/hr |
| Startup | $99 | 500 hrs | $0.10/hr |
| Scale | Custom | Custom | Negotiated |

**Key:** Tightly integrated with Stagehand. Provides serverless browser infra accessible via Playwright, Puppeteer, or Selenium.

#### When to use managed services vs self-hosted:

| Factor | Self-Hosted (ECS/Docker) | Managed (Browserless/Browserbase) |
|--------|--------------------------|-----------------------------------|
| Cost at low volume | Higher (infrastructure overhead) | Lower (pay-per-use) |
| Cost at high volume | Lower (amortized) | Higher (per-unit fees) |
| Anti-bot features | DIY (stealth plugins) | Built-in |
| Operational overhead | High (updates, scaling, monitoring) | Low |
| Data residency | Full control | Depends on provider |
| Latency | Controlled | Depends on region |

**Recommendation:** Start with Browserless.io Starter ($140/mo) during development and early production. Migrate to self-hosted ECS Fargate when you exceed ~500K units/month or need data residency control.

---

## 3. Reliability Patterns

### 3.1 Deterministic vs AI-Guided Navigation

| Dimension | Deterministic Scripts | AI-Guided Navigation |
|-----------|----------------------|---------------------|
| Reliability | ~100% on known pages | 70–85% on novel pages |
| Speed | Sub-second execution | 2–10s per action (LLM latency) |
| LLM cost | $0 | $0.01–0.15 per page |
| Maintenance | Breaks on UI changes | Self-healing |
| Coverage | Only known flows | Discovers new paths |

**Hybrid approach (recommended):** Use deterministic Playwright scripts as the backbone. Inject AI at specific decision points where the page structure is unpredictable. Stagehand's model of writing Playwright code with selective `act()`/`extract()` calls is the best pattern for this.

### 3.2 Login Flow Patterns

**Step 1: Record the login flow with Codegen**
```bash
npx playwright codegen --save-storage=auth.json https://example.com/login
```

**Step 2: Save and reuse session state**
```typescript
// After login
await page.context().storageState({ path: 'auth/user.json' });

// Reuse in subsequent sessions
const context = await browser.newContext({
  storageState: 'auth/user.json'
});
```

**Step 3: Implement session health checks**
```typescript
async function isSessionValid(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  await page.goto('https://example.com/dashboard');
  const url = page.url();
  const isValid = !url.includes('/login') && !url.includes('returnUrl');
  await page.close();
  return isValid;
}
```

**Step 4: Re-login on expiry**
```typescript
async function ensureAuthenticated(browser: Browser): Promise<BrowserContext> {
  try {
    const context = await browser.newContext({ storageState: 'auth/user.json' });
    if (await isSessionValid(context)) return context;
    await context.close();
  } catch {}
  // Re-login and save fresh state
  const context = await browser.newContext();
  await performLogin(context);
  await context.storageState({ path: 'auth/user.json' });
  return context;
}
```

**Session expiry signals to monitor:**
- Final URL contains `/login` or `returnUrl=`
- HTTP 401/403 responses
- Redirect loops back to auth pages
- Role/permission mismatch errors

### 3.3 CAPTCHA Handling

**Strategy hierarchy (most to least preferred):**

1. **Avoid CAPTCHAs entirely:** Use API access, partner integrations, or pre-authenticated sessions
2. **Use provider test keys:** Many CAPTCHA providers offer test/development keys that auto-pass
3. **Third-party solving services:**
   - **2Captcha:** Supports reCAPTCHA v2/v3, Cloudflare Turnstile ($2.99/1000 solves)
   - **Anti-Captcha:** RecaptchaV2TaskProxyless API, good Playwright integration
   - **Browserless.io:** Built-in CAPTCHA solving in their managed service
4. **Libraries:** `playwright-captcha` (supports click-based and API-based solving), `auto-captcha-solver` (multi-provider fallback, 15+ CAPTCHA types)

**Integration pattern:**
```typescript
// Detect CAPTCHA
const captchaFrame = await page.$('iframe[src*="recaptcha"]');
if (captchaFrame) {
  const siteKey = await page.$eval('.g-recaptcha', el => el.getAttribute('data-sitekey'));
  // Submit to solving service
  const solution = await solveCaptcha(siteKey, page.url());
  // Inject solution
  await page.evaluate((token) => {
    document.getElementById('g-recaptcha-response').innerHTML = token;
  }, solution);
  await page.click('button[type="submit"]');
}
```

**Warning:** CAPTCHA bypassing may violate terms of service. For production use on third-party sites, prefer API access or manual user intervention for initial auth.

### 3.4 Error Recovery and Retry

**Retry strategy:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; backoffMs: number; onRetry?: (error: Error, attempt: number) => void }
): Promise<T> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === options.maxRetries) throw error;
      options.onRetry?.(error as Error, attempt);
      await new Promise(r => setTimeout(r, options.backoffMs * Math.pow(2, attempt)));
    }
  }
  throw new Error('Unreachable');
}
```

**Common failure buckets and recovery:**

| Failure Type | Detection | Recovery |
|-------------|-----------|----------|
| Stale DOM | `ElementHandleError` | Re-query element, retry action |
| Navigation timeout | `TimeoutError` on goto | Retry with longer timeout, check network |
| Auth drift | URL redirects to `/login` | Re-authenticate, refresh storage state |
| Bot detection | 403, Cloudflare challenge page | Switch proxy, add delays, use stealth |
| Element not found | `locator.click()` timeout | Take screenshot, fall back to AI guidance |
| Network error | `net::ERR_*` errors | Retry with exponential backoff |
| Dialog blocking | Unexpected alert/confirm | Register `page.on('dialog')` handler |

### 3.5 Recording and Replaying Flows

**Playwright Codegen** generates scripts by recording user interactions:
```bash
npx playwright codegen https://example.com
```

**Trace recording** captures detailed execution data:
```typescript
const context = await browser.newContext();
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
// ... perform actions ...
await context.tracing.stop({ path: 'trace.zip' });
// View with: npx playwright show-trace trace.zip
```

**Best practice:** Use Codegen output as a starting point, then refactor for maintainability. Raw recorded scripts use brittle selectors—replace with `getByRole()`, `getByTestId()`, and semantic locators.

---

## 4. Security

### 4.1 Credential Management

**Hierarchy of approaches (most to least secure):**

1. **HashiCorp Vault / AWS Secrets Manager**
   - Short-lived, rotating secrets retrieved at runtime
   - CI authenticates via OIDC/GitHub Actions JWT
   - Secrets expire after use, zero residue
   - Map vault policies to automation roles

2. **1Password / Bitwarden CLI integration**
   - Vault-backed credential discovery
   - Approval gates for sensitive operations
   - Built-in audit logging

3. **Platform-native secrets (CI/CD)**
   - GitHub Actions secrets, AWS Parameter Store
   - Encrypted at rest, injected as env vars
   - No file artifacts

4. **Environment variables (minimum viable)**
   - `.env` files for local development only
   - Never committed to version control
   - Loaded via `dotenv` in Playwright config

**Critical rules:**
- Never hardcode credentials in automation scripts
- Never commit `auth.json` / storage state files to git
- Rotate credentials per-run when possible
- Log all secret access for audit compliance

### 4.2 Browser Session Sandboxing

**Container-level isolation (recommended for production):**
- Each automation task runs in a disposable Docker container
- Container destroyed after task completion (no state leakage)
- Network egress restricted via security groups / network policies
- No persistent storage between runs

**Browser-level isolation:**
- Use separate `BrowserContext` for each task (isolated cookies, storage, cache)
- Incognito contexts prevent cross-session data leakage
- Domain allowlisting restricts navigation to approved sites

**Process-level:**
- Run Chromium with `--no-sandbox` only inside trusted containers
- Disable `--disable-web-security` in production
- Disable remote debugging unless explicitly needed

### 4.3 Preventing Data Leakage

**Architectural controls:**
- Domain allowlisting: restrict browser navigation to approved domains
- Network egress filtering: block outbound connections except to target sites
- Log sanitization: strip PII, credentials, and sensitive form data from logs
- Data minimization: extract only needed fields, don't store full page content
- Disable clipboard access unless required

**AI-specific risks:**
- **Prompt injection:** Malicious hidden text on pages can instruct the AI agent to exfiltrate data
- **Mitigation:** Validate AI actions against an allowlist of expected behaviors, implement human-in-the-loop for sensitive operations

### 4.4 Audit Logging

**Minimum audit trail for compliance (SOC 2, HIPAA, GDPR):**

```typescript
interface BrowserActionLog {
  timestamp: string;
  taskId: string;
  action: string;          // navigate, click, type, extract
  target: string;          // URL or element description
  result: 'success' | 'failure';
  screenshotPath?: string; // Visual evidence
  userId: string;          // Who initiated the automation
  metadata: Record<string, unknown>;
}
```

**Visual evidence:** Use Playwright MCP + PageBolt MCP (or custom screenshot middleware) to capture timestamped screenshots at critical decision points. Store immutably in S3 with lifecycle policies.

**Trace files:** Playwright's built-in tracing (`context.tracing`) provides complete execution replay including screenshots, DOM snapshots, network requests, and console logs.

---

## 5. Specific Use Cases

### 5.1 Form Filling on Third-Party Websites

**Tier 1 approach (known forms):**
```typescript
await page.goto('https://vendor.com/application');
await page.getByLabel('Company Name').fill(data.companyName);
await page.getByLabel('Contact Email').fill(data.email);
await page.getByLabel('Phone').fill(data.phone);
await page.getByRole('combobox', { name: 'State' }).selectOption(data.state);
await page.getByRole('button', { name: 'Submit' }).click();
```

**Tier 2 approach (semi-known forms with Stagehand):**
```typescript
// Known navigation
await page.goto('https://vendor.com/application');
// AI-guided form filling for dynamic fields
await stagehand.act(`Fill in the company name field with "${data.companyName}"`, { page });
await stagehand.act(`Select "${data.state}" from the state dropdown`, { page });
await stagehand.act('Click the Submit button', { page });
```

**Tier 3 approach (unknown forms with Browser Use/Skyvern):**
- Send the full task description + data payload to the AI agent
- Agent navigates, discovers form fields, fills them, handles dynamic validation
- Human review before final submission for high-stakes forms

### 5.2 Portal Status Checking

**Best pattern: Deterministic with session reuse**
```typescript
async function checkPortalStatus(portal: Portal): Promise<StatusResult> {
  const context = await ensureAuthenticated(browser, portal.credentials);
  const page = await context.newPage();
  await page.goto(portal.statusUrl);
  
  // Extract status using stable selectors or AI
  const status = await page.locator('[data-testid="application-status"]').textContent();
  // OR with AI fallback:
  // const status = await stagehand.extract('Extract the application status', schema, { page });
  
  await page.close();
  return { portal: portal.name, status, checkedAt: new Date() };
}
```

**Scheduling:** Run via ECS Scheduled Tasks (cron) or EventBridge rules. Store results in your database with timestamps for trend tracking.

### 5.3 Research / Data Extraction

**For structured extraction from known sites:**
```typescript
const data = await stagehand.extract(
  'Extract all company executives with their names, titles, and LinkedIn URLs',
  z.object({
    executives: z.array(z.object({
      name: z.string(),
      title: z.string(),
      linkedinUrl: z.string().optional(),
    }))
  }),
  { page }
);
```

**For multi-page research across unknown sites:**
- Use Browser Use (Python) or Skyvern for autonomous navigation
- Define the research objective as a natural language prompt
- Implement token/cost budgets to prevent runaway spending
- Store extracted data with source URLs for verification

### 5.4 Booking / Scheduling

**High reliability required — use deterministic scripts with AI fallback:**
1. Record the booking flow with Codegen for each platform
2. Parameterize the script (date, time, service type)
3. Add AI fallback for calendar widget interactions (often custom, hard to automate deterministically)
4. Implement idempotency checks (verify no duplicate bookings)
5. Require human confirmation before final booking submission
6. Capture screenshot evidence of confirmation page

---

## 6. Alternatives & Complements

### 6.1 Comparison Matrix

| Tool | Language | Approach | Open Source | Best For | Weakness |
|------|----------|----------|-------------|----------|----------|
| **Playwright** (raw) | TS/JS/Python/Java/C# | Deterministic scripts | Yes (Apache 2.0) | Known flows, speed, reliability | Breaks on UI changes |
| **Playwright MCP** | Any (via MCP) | Accessibility snapshots + LLM | Yes (Apache 2.0) | AI agent integration | LLM cost per action |
| **Stagehand** | TypeScript | Hybrid (Playwright + AI primitives) | Yes (MIT) | Surgical AI in deterministic flows | Tied to Browserbase infra |
| **Browser Use** | Python | Full AI agent | Yes (MIT) | Autonomous browsing, Python shops | 89.1% WebVoyager (not 100%) |
| **Skyvern** | Python | Vision LLM + Planner-Agent-Validator | Yes (AGPL 3.0) | Form filling at scale, no-code | Cloud-hosted concerns, AGPL license |
| **AgentQL** | Python/Node.js | Semantic query language | Proprietary | Cross-site data extraction | Less mature, less community |
| **Browserless.io** | Any (via API) | Managed browser infrastructure | No | Scaling without ops burden | Vendor lock-in, per-unit cost |
| **Browserbase** | Any (via API) | Managed browser infrastructure | No | Stagehand integration | Cost at scale |

### 6.2 Tool Deep Dives

#### Stagehand (by Browserbase)

**API surface:** Three methods that compose with standard Playwright code:
- `act(instruction, { page })` — Perform a described action
- `extract(instruction, schema, { page })` — Extract structured data with Zod schema validation
- `observe(instruction, { page })` — Discover actionable elements, returns XPath + descriptions

**Key advantage:** You write Playwright code and inject AI only where needed. This gives you deterministic control with AI resilience.

**Example hybrid flow:**
```typescript
// Deterministic: navigate to known URL
await page.goto('https://portal.example.com');
// Deterministic: fill known fields
await page.getByLabel('Username').fill(credentials.username);
await page.getByLabel('Password').fill(credentials.password);
await page.getByRole('button', { name: 'Sign In' }).click();
// AI: handle dynamic dashboard (layout changes frequently)
await stagehand.act('Click on the Applications section', { page });
const status = await stagehand.extract('Extract application status and date', statusSchema, { page });
```

#### Browser Use (Python)

**Architecture:** Python-native, built on Playwright, supports multiple LLM providers.

**Best for:** Python-first teams building autonomous browser agents.

```python
from browser_use import Agent
from langchain_openai import ChatOpenAI

agent = Agent(
    task="Go to example.com, find the pricing page, and extract all plan names and prices",
    llm=ChatOpenAI(model="gpt-4o"),
)
result = await agent.run()
```

**Current benchmarks:** 89.1% on WebVoyager (best in class as of early 2026).

#### Skyvern

**Architecture:** Planner-Agent-Validator with vision LLMs. Python-based, compatible with Playwright.

**Best for:** Form filling workflows, especially government/compliance forms where layout changes frequently.

**Deployment:** Docker Compose, Kubernetes, or Skyvern Cloud. AGPL-3.0 license means self-hosted use requires open-sourcing modifications (or purchasing a commercial license).

#### AgentQL

**Approach:** Semantic query language for the web — like CSS selectors but meaning-based.

**Best for:** Cross-site data extraction where the same query works across similar sites (e.g., extracting product data from both Amazon and Walmart).

**Limitation:** Less mature ecosystem, smaller community compared to Browser Use or Stagehand.

---

## 7. Tiered Architecture Recommendation

### Tier 1: Deterministic Playwright Scripts

**When:** The target site is known, the flow is stable, and you control or can predict the page structure.

**Implementation:**
- Write Playwright scripts using semantic locators (`getByRole`, `getByTestId`, `getByLabel`)
- Record initial flow with `playwright codegen`, then refactor for maintainability
- Save and reuse session state via `storageState`
- Run as ECS Fargate tasks or Lambda functions (for short flows)

**Reliability:** ~100% on known pages
**Cost:** $0 LLM cost, ~$0.001/run in compute
**Latency:** Sub-second per action

**Use for:**
- Login flows on known sites
- Status checks on portals with stable layouts
- Form submissions where field selectors are reliable
- Scheduled data extraction from known pages

### Tier 2: AI-Guided Playwright (Stagehand Model)

**When:** The target site is semi-known — you understand the general flow but specific selectors or layouts change.

**Implementation:**
- Write Playwright code for the deterministic parts (navigation, known fields)
- Use Stagehand's `act()`, `extract()`, `observe()` for dynamic elements
- Define Zod schemas for structured extraction
- Implement fallback: try deterministic first, fall back to AI on failure

```typescript
async function fillField(page: Page, stagehand: Stagehand, label: string, value: string) {
  try {
    // Tier 1: try deterministic first
    await page.getByLabel(label).fill(value, { timeout: 3000 });
  } catch {
    // Tier 2: fall back to AI
    await stagehand.act(`Fill the "${label}" field with "${value}"`, { page });
  }
}
```

**Reliability:** 85–95% (higher than pure AI, more resilient than pure deterministic)
**Cost:** $0.01–0.15 per AI-assisted action
**Latency:** 2–5s per AI-assisted action

**Use for:**
- Forms that change layout periodically
- Portal status checks where the dashboard structure varies
- Data extraction from sites that A/B test their UI
- Multi-step workflows with some dynamic steps

### Tier 3: Full AI Browser Agent

**When:** The target page is completely unknown, or the task requires exploration and discovery.

**Implementation:**
- Use Browser Use (Python) or Skyvern for fully autonomous browsing
- Define the task in natural language with constraints
- Implement token/cost budgets
- Require human review for high-stakes actions
- Capture full trace for audit

```python
agent = Agent(
    task="""
    Go to {url}. Find the contact form or partnership inquiry page.
    Fill it out with the following information: {data}.
    Do NOT submit the form — stop before the final submit button and take a screenshot.
    """,
    llm=ChatOpenAI(model="gpt-4o"),
    max_actions=50,
)
```

**Reliability:** 70–85% (depends on site complexity)
**Cost:** $0.50–5.00 per task (many LLM calls)
**Latency:** 30s–5min per task

**Use for:**
- Research across unknown websites
- One-off form fills on new platforms
- Exploratory data gathering
- Fallback when Tier 1 and Tier 2 fail

### Tier Selection Logic

```
For each automation task:
  1. Is the site known and the flow mapped?
     → YES: Use Tier 1 (deterministic Playwright)
     → NO: Continue to 2

  2. Is the general flow pattern known (e.g., "it's a form", "it's a status dashboard")?
     → YES: Use Tier 2 (Playwright + Stagehand AI)
     → NO: Continue to 3

  3. Use Tier 3 (full AI agent) with:
     - Cost budget
     - Action limit
     - Human review gate for sensitive actions
     - Full trace capture

  Auto-promotion: When a Tier 3 task succeeds, record the flow and
  promote to Tier 2 or Tier 1 for subsequent runs.
```

### Recommended Tech Stack

```
┌─────────────────────────────────────────────────────┐
│                    Orchestrator                       │
│         (Node.js/TypeScript application)              │
├─────────────┬──────────────┬────────────────────────┤
│   Tier 1    │    Tier 2    │        Tier 3           │
│  Playwright │  Playwright  │   Browser Use /         │
│  (raw API)  │ + Stagehand  │   Skyvern               │
├─────────────┴──────────────┴────────────────────────┤
│              Browser Infrastructure                   │
│  Dev/Low volume: Browserless.io Starter ($140/mo)    │
│  High volume: Self-hosted ECS Fargate                │
├─────────────────────────────────────────────────────┤
│                    Security Layer                     │
│  AWS Secrets Manager │ Session Isolation │ Audit Logs │
├─────────────────────────────────────────────────────┤
│                    Storage                            │
│  S3 (screenshots, traces) │ DB (results, audit logs) │
└─────────────────────────────────────────────────────┘
```

---

## 8. Cost Analysis

### Per-Task Cost Estimates

| Scenario | Tier | Compute | LLM | Total/task |
|----------|------|---------|-----|------------|
| Status check (known portal) | 1 | $0.001 | $0 | ~$0.001 |
| Form fill (known form) | 1 | $0.002 | $0 | ~$0.002 |
| Form fill (semi-known) | 2 | $0.002 | $0.05–0.30 | ~$0.05–0.30 |
| Data extraction (known) | 1 | $0.001 | $0 | ~$0.001 |
| Data extraction (AI-assisted) | 2 | $0.002 | $0.10–0.50 | ~$0.10–0.50 |
| Full autonomous research | 3 | $0.01 | $0.50–5.00 | ~$0.50–5.00 |

### Monthly Infrastructure Cost Estimates

| Scale | Self-Hosted (ECS Fargate) | Browserless.io | Browserbase |
|-------|--------------------------|----------------|-------------|
| 1,000 tasks/mo | ~$50 (1 task, on-demand) | $25 (Prototyping) | $20 (Developer) |
| 10,000 tasks/mo | ~$150 (auto-scaling) | $140 (Starter) | $99 (Startup) |
| 100,000 tasks/mo | ~$400 (reserved) | $350+ (Scale) | Custom |
| 1,000,000 tasks/mo | ~$2,000 (Spot instances) | $3,000+ (Enterprise) | Custom |

### Key Cost Optimization Strategies

1. **Session reuse:** Save and reuse `storageState` to skip login flows (saves 30–60s per task)
2. **Tier promotion:** Auto-promote Tier 3 → Tier 2 → Tier 1 as flows become known
3. **Browser context pooling:** Reuse browser instances with multiple contexts instead of cold-starting
4. **Accessibility snapshots over screenshots:** 10–100x cheaper token cost for LLM interactions
5. **Spot/preemptible instances:** 60–70% savings for non-time-critical batch automation
6. **Batch scheduling:** Group tasks by target site to maximize session reuse

---

## Key Takeaways

1. **Start with Playwright MCP + accessibility snapshots** — it's the most cost-effective and reliable way to integrate AI with browser automation
2. **Build the tiered system** — Tier 1 deterministic scripts should handle 80%+ of known flows; reserve AI for the remaining 20%
3. **Stagehand is the best hybrid model** — it lets you write Playwright code with surgical AI injection, avoiding the all-or-nothing choice
4. **ECS Fargate is the production sweet spot** — no server management, no time limits, auto-scaling, and reasonable cost
5. **Security is non-negotiable** — use Secrets Manager, container isolation, domain allowlisting, and audit logging from day one
6. **CAPTCHAs are the hardest problem** — prefer API access or pre-authenticated sessions; third-party solving services are a last resort
7. **Promote flows upward** — every Tier 3 success should become a Tier 2 template, and stable Tier 2 flows should graduate to Tier 1 scripts
