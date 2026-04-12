# FB Outreach - Automated Lead Generation & Outreach System

**Complete end-to-end lead generation system** combining:
1. **Automated Lead Discovery** - Scrapes Facebook groups, classifies comments with LLM
2. **Messenger Bot** - Review-first Playwright workflow for outreach
3. **Autopilot System** - Self-improving autonomous pipeline
4. **Dashboard** - Electron desktop app for monitoring and control

## System Architecture

### Pipeline (Backend Service)
- **Lead Finder**: Scrapes FB groups, LLM classification (AWS Bedrock Nova Micro)
- **Group Discovery**: Searches for new groups, tracks performance
- **Keyword Generation**: LLM-powered search term optimization (Sonnet 4.6)
- **Group Retention**: Keeps top 50 performers, retires underperformers
- **Autopilot**: Fully autonomous cycle (scrape → classify → export → message)
- **Database**: SQLite with WAL mode for concurrency

### Dashboard (Desktop App)
- Real-time autopilot monitoring
- Lead & group management
- Configuration interface
- Live console output
- Performance metrics

### Messenger Bot
- Playwright-based automation
- Manual review mode (stable assistive workflow)
- Personalized messaging with templates
- Image attachment support

## Quick Start

### Local Development

**Pipeline:**
```bash
cd pipeline
npm install
cp .env.example .env  # Configure your AWS credentials
node index.js
```

**Dashboard:**
```bash
cd dashboard
npm install
npm run setup  # Rebuild native dependencies
npm start
```

**Messenger Bot:**
```bash
npm install
# Copy and configure campaign config
cp campaign.config.example.json campaign.config.json
# Run messenger bot
npm start
```

## Railway Deployment

Deploy the pipeline to Railway for 24/7 automated operation.

### Prerequisites
- Railway CLI: `npm install -g @railway/cli`
- GitHub account
- AWS credentials (Bedrock access)

### Deploy Steps

1. **Login and initialize**
```bash
railway login
railway init
```

2. **Link to GitHub** (recommended)
   - Push this repo to GitHub
   - Connect Railway to your GitHub repo
   - Railway will auto-deploy on every push

3. **Configure environment variables in Railway dashboard:**
   - `AWS_REGION` - e.g., `us-east-1`
   - `AWS_BEARER_TOKEN_BEDROCK` - Your Bedrock bearer token
   - `DATABASE_PATH` - `/app/data/pipeline.db`
   - `NODE_ENV` - `production`
   - See full list in `.env.example`

4. **Add volume for SQLite persistence:**
   - Railway dashboard → Volume → Create
   - Mount path: `/app/data`

5. **Deploy:**
```bash
railway up
```

### Environment Variables

**Required:**
- `AWS_REGION` - AWS region for Bedrock
- `AWS_BEARER_TOKEN_BEDROCK` - Bedrock API token
- `DATABASE_PATH` - `/app/data/pipeline.db` (Railway volume path)

**Optional (with defaults):**
- `FB_FINDER_DAILY_BUDGET=15.0` - Daily LLM spend limit
- `FB_FINDER_MIN_CONFIDENCE=0.7` - Classification threshold
- `FB_FINDER_GROUPS_PER_SCRAPE=4` - Groups per cycle
- `AUTOPILOT_CYCLE_INTERVAL=3600000` - Cycle interval (1 hour)
- `AUTOPILOT_ENABLE_MESSAGING=true` - Auto-message leads
- `QUIET_HOURS_START=2` - No scraping start hour
- `QUIET_HOURS_END=6` - No scraping end hour
- `TEST_MODE=false` - Bypass restrictions for testing

## Project Structure

### Pipeline
- `pipeline/` - Backend service
  - `fb-finder/` - Lead discovery modules
    - `scraper.js` - Playwright group scraping
    - `classifier.js` - LLM classification
    - `group-manager.js` - Explore/exploit selection
    - `lead-exporter.js` - CSV export
    - `keyword-generator.js` - LLM keyword generation
    - `group-retention.js` - Performance-based retention
    - `messenger-integration.js` - Bot trigger
  - `jobs/` - Cron job orchestrators
  - `templates/` - LLM prompts
  - `db.js` - SQLite operations
  - `config.js` - Configuration
  - `index.js` - Main entry (cron scheduler)
  - `autopilot.js` - Autonomous loop

### Dashboard
- `dashboard/` - Electron desktop app
  - `main.js` - IPC handlers
  - `preload.js` - Context bridge
  - `renderer/` - UI components

### Scripts
- `scripts/fb-review-send.js` - Messenger bot

## Messenger Bot Configuration

### Files

- `campaign.config.example.json`: copy to `campaign.config.json` and fill in your paths
- `leads.example.csv`: example lead file
- `message-template.txt`: message body with `{{firstName}}`
- `scripts/fb-review-send.js`: the Playwright runner

## CSV format

Your CSV needs these headers:

```csv
firstName,messageId
Taylor,123456789012345
Jordan,234567890123456
```

## Config

Example:

```json
{
  "leadsCsvPath": "./leads.csv",
  "messageTemplatePath": "./message-template.txt",
  "imagePath": "",
  "userDataDir": "./.session/facebook",
  "threadUrlTemplate": "https://www.facebook.com/messages/t/{messageId}",
  "browserChannel": "chrome",
  "headless": false,
  "sendMode": "manual",
  "postActionDelayMs": 45000,
  "startAtRow": 1
}
```

Notes:

- `sendMode: "manual"` means the script prepares the thread and waits for you to send in the browser.
- `sendMode: "terminalConfirm"` means the script will click Facebook's send button only after you approve each lead in the terminal.
- `postActionDelayMs` is a fixed cooldown after each lead is handled.
- `threadUrlTemplate` must contain `{messageId}`.

## Run

1. Copy `campaign.config.example.json` to `campaign.config.json`.
2. Create `leads.csv`.
3. If you want the image upload step, put your outreach image at the configured `imagePath`.
4. Update `message-template.txt`.
5. Run:

```bash
npm start
```

## What To Expect

1. Chrome opens to Messenger.
2. You log in manually if needed.
3. Press Enter in the terminal to begin.
4. For each lead, the script opens the thread, clicks `Continue` if it appears, fills the message, uploads the image, and waits.
5. You either send manually in the browser or approve terminal-confirm sending, depending on config.

## Troubleshooting

- If Facebook changes its UI, you may need to update the selector lists in `scripts/fb-review-send.js`.
- On failure, the script saves a screenshot under `artifacts/`.
- If Chrome channel launch fails, the script falls back to Playwright's bundled Chromium.
