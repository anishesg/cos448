# FB Outreach - Deployment Guide

## 🎯 System Overview

This system is **modularized into two independent pipelines**:

1. **Email Pipeline** - Runs on Railway (cloud)
2. **FB Scraping Pipeline** - Runs locally only

---

## ☁️ Railway Deployment (LIVE)

### Service Details
- **Project:** fb-outreach-pipeline
- **Service:** email-pipeline
- **Status:** ✅ RUNNING
- **URL:** https://railway.com/project/f5840cdb-0356-401f-ab86-4b36a7cdf80b
- **GitHub:** https://github.com/anishesg/fb-outreach

### What's Running
- 📧 Form signup detection (every 5 min)
- 📅 Meeting scheduling via Google Calendar (every 5 min)
- ⏰ Email reminders (every 10 min)
- 💌 Post-meeting follow-ups (every 30 min)

### Configuration
```bash
# View all environment variables
railway variable list

# View logs
railway logs

# Check status
railway status

# Open dashboard
railway open
```

### Environment Variables (Already Set)
✅ All configured via Railway CLI:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_SHEET_ID`
- `AWS_BEARER_TOKEN_BEDROCK`
- `AWS_BEDROCK_REGION`
- `TIMEZONE`
- `MEETING_DURATION_MINUTES`
- `WINDOW_START_HOUR`
- `WINDOW_END_HOUR`
- `SCHEDULING_HORIZON_DAYS`
- `ALLOWED_DAYS`
- `NODE_ENV`

### Volume
✅ SQLite database volume created:
- **Mount path:** `/app/data`
- **Name:** email-pipeline-volume

### ⚠️ Required: Enable Google APIs
Visit Google Cloud Console and enable:
1. **Google Sheets API** - https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=810139360506
2. **Google Calendar API** - For meeting scheduling
3. **Gmail API** - For sending emails

Wait 5-10 minutes after enabling for propagation.

---

## 💻 Local Development

### Email Pipeline Only
```bash
cd pipeline
npm run start:email
```

Runs: Scheduling, reminders, follow-ups (same as Railway)

### FB Scraping Pipeline Only
```bash
cd pipeline
npm run start:fb
```

Runs: Group scraping, discovery, lead export (3x/day schedule)

### Autopilot (Autonomous Mode)
```bash
cd pipeline
npm run start:autopilot
```

Runs: Full autonomous cycle with self-improvement

### Full Pipeline (Both)
```bash
cd pipeline
npm start
```

Runs: Email pipeline + FB scraping together

### Dashboard
```bash
cd dashboard
npm start
```

Electron app for monitoring and control

---

## 📂 Project Structure

### Deployed to Railway
```
pipeline/
├── email-pipeline.js     ← Entry point (Railway)
├── db.js
├── config.js
├── google/               ← Google API integration
│   ├── auth.js
│   ├── calendar.js
│   ├── gmail.js
│   └── sheets.js
├── llm/
│   └── email-drafter.js  ← AWS Bedrock email drafting
├── jobs/
│   ├── detect-signups.js
│   ├── schedule.js
│   ├── remind.js
│   └── followup.js
└── templates/
```

### Local Only (Excluded via .dockerignore)
```
pipeline/
├── fb-pipeline.js        ← FB scraping entry point
├── autopilot.js          ← Autonomous mode
├── fb-finder/            ← All FB scraping modules
│   ├── scraper.js        (Playwright)
│   ├── classifier.js     (LLM classification)
│   ├── group-manager.js
│   ├── keyword-generator.js
│   ├── group-retention.js
│   ├── messenger-integration.js
│   └── ...
├── jobs/
│   ├── scrape-groups.js
│   ├── discover-groups.js
│   └── export-leads.js
└── ...

scripts/
└── fb-review-send.js     ← Messenger bot

dashboard/                ← Electron app
├── main.js
├── preload.js
└── renderer/
```

---

## 🚀 Deployment Workflow

### Automatic Deployment (GitHub → Railway)

1. **Make changes locally:**
```bash
git add .
git commit -m "Your changes"
git push
```

2. **Railway auto-deploys** from GitHub main branch

3. **Monitor deployment:**
```bash
railway logs
```

### Manual Deployment

```bash
# Deploy directly from local files
railway up

# Deploy in background
railway up --detach

# Redeploy latest
railway deployment redeploy
```

---

## 🔧 Troubleshooting

### Check Service Status
```bash
railway status
railway service status
```

### View Logs
```bash
railway logs

# Specific deployment
railway logs --deployment <deployment-id>

# Follow logs in real-time
railway logs --follow
```

### Restart Service
```bash
railway restart
```

### Update Environment Variable
```bash
railway variable set KEY="value"
```

### Test Google Auth Locally
```bash
cd pipeline
npm run reauth
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                 Railway Cloud                    │
├─────────────────────────────────────────────────┤
│  email-pipeline.js (Node.js 20)                 │
│  ├── Google Sheets → Detect signups             │
│  ├── Google Calendar → Schedule meetings        │
│  ├── Gmail → Send reminders & follow-ups        │
│  └── AWS Bedrock → Draft personalized emails    │
│                                                  │
│  SQLite Volume: /app/data                       │
│  Auto-deploy: GitHub push → main                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Local Machine Only                  │
├─────────────────────────────────────────────────┤
│  fb-pipeline.js (Playwright + LLM)              │
│  ├── Scrape FB groups (3x/day)                  │
│  ├── Discover new groups (daily)                │
│  ├── Classify comments (Nova Micro)             │
│  └── Export leads to CSV                        │
│                                                  │
│  autopilot.js (Autonomous)                      │
│  ├── Scrape → Classify → Export → Message      │
│  ├── Generate keywords (Sonnet 4.6)            │
│  ├── Intelligent group retention (top 50)       │
│  └── Self-improving via LLM analysis            │
│                                                  │
│  dashboard/ (Electron)                          │
│  └── Monitor, control, view metrics             │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Next Steps

1. **Enable Google APIs** (required for Railway service)
   - Sheets API
   - Calendar API
   - Gmail API

2. **Test locally:**
   ```bash
   cd pipeline
   npm run start:email  # Test email pipeline
   ```

3. **Monitor Railway logs:**
   ```bash
   railway logs
   ```

4. **Run FB scraping locally when needed:**
   ```bash
   cd pipeline
   npm run start:fb
   # or for autonomous mode:
   npm run start:autopilot
   ```

5. **Launch dashboard for monitoring:**
   ```bash
   cd dashboard
   npm start
   ```

---

## 💡 Tips

- **Railway logs** show real-time execution of cron jobs
- **Dashboard** provides visual monitoring of all operations
- **Autopilot mode** runs completely autonomously with self-improvement
- **Test mode** (local only) bypasses all restrictions for testing
- **GitHub integration** means every push automatically deploys to Railway

---

## 📞 Support

- **Railway Dashboard:** https://railway.com/project/f5840cdb-0356-401f-ab86-4b36a7cdf80b
- **GitHub Repo:** https://github.com/anishesg/fb-outreach
- **Railway CLI Docs:** https://docs.railway.app/reference/cli-api

---

**Last Updated:** 2026-04-12  
**Deployment Status:** ✅ LIVE & RUNNING
