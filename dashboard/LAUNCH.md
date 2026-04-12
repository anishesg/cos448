# How to Launch the Dashboard

## First Time Setup

```bash
cd "/Users/anish/Desktop/Lattice Research/fb_outreach/dashboard"
npm run setup
```

This will:
1. Install Electron, better-sqlite3, and dependencies
2. Rebuild better-sqlite3 for Electron's Node version
3. You only need to do this once

## Launch the App

```bash
cd "/Users/anish/Desktop/Lattice Research/fb_outreach/dashboard"
npm start
```

The dashboard will open in a native macOS window.

## What You'll See

### On First Launch
- Overview page with stats (may show 0s if no scraping has run yet)
- Sidebar navigation on the left
- Pipeline status at bottom (initially offline)

### Getting Started
1. **Add Groups**: Go to Groups tab → paste Facebook group URLs
2. **Run a Scrape**: Overview tab → click "Run Scrape" button
3. **Watch Activity**: Activity tab → see live job output
4. **Start Pipeline**: Settings tab → click "Start Pipeline" for automation

## Troubleshooting

### "Cannot find module better-sqlite3"
Run: `cd dashboard && npm run rebuild`

### "Database file not found"
Make sure the pipeline has been initialized:
```bash
cd ../pipeline
node -e "import('./db.js').then(m => m.getDb())"
```

### Window doesn't appear
Check Console.app for Electron errors, or run with debug:
```bash
ELECTRON_ENABLE_LOGGING=1 npm start
```

## Features to Try

1. **Quick Actions** (Overview): Instantly trigger scrape/discover/export jobs
2. **Live Console** (Activity): Watch real-time output from running jobs  
3. **Lead Search** (Leads): Filter by status, search by name/comment
4. **Group Management** (Groups): Pause underperforming groups, add new ones
5. **Config Tweaks** (Settings): Adjust confidence thresholds, cooldown times
6. **Pipeline Control** (Settings): Start/stop the automated cron daemon

## Tips

- Keep the dashboard open while the pipeline runs to see live updates
- Stats refresh every 10 seconds automatically
- Job output streams in real-time to the console
- All changes to settings require a pipeline restart to take effect
- The dashboard shares the same database as the pipeline (no sync needed)
