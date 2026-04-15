# FB Outreach Bot - Testing Guide

## Current Status: ✅ READY TO TEST

### What's Working:
1. ✅ Playwright installed and functional
2. ✅ Database initialized (pipeline.db created)
3. ✅ Test Facebook group added to database
4. ✅ Environment configuration set up
5. ✅ Scraper module loads successfully
6. ✅ Messenger bot script loads successfully

---

## Quick Test (Recommended First Step)

### Test 1: Database & Scraper Module
```bash
cd /Users/anish/Desktop/cos448/pipeline

# Check database
node -e "
import('./db.js').then(({ getDb }) => {
  const db = getDb();
  const groups = db.prepare('SELECT * FROM fb_groups').all();
  const leads = db.prepare('SELECT COUNT(*) as count FROM fb_leads').get();
  console.log('Groups:', groups.length);
  console.log('Leads:', leads.count);
  console.log('\\nFirst group:', groups[0]);
}).catch(e => console.error('Error:', e.message));
"
```

### Test 2: Launch Browser & Test Scraping
```bash
cd /Users/anish/Desktop/cos448/pipeline

# This will:
# - Open Chrome with your session
# - Navigate to the test group
# - Take screenshots at each step
# - Test keyword searches
node test-scraper-live.js
```

**What to expect:**
- Browser opens (non-headless)
- You may need to log into Facebook if not already logged in
- It will navigate to the Facebook group
- Search for keywords like "SAT", "ACT", "college"
- Take screenshots in `test-screenshots/` folder
- Show results in terminal

---

## Full Scraping Test

### Test 3: Run Full Scrape Cycle
```bash
cd /Users/anish/Desktop/cos448/pipeline

# Run a single scrape cycle
node -e "
import('./fb-finder/scraper.js').then(async ({ runScrapeCycle }) => {
  import('./db.js').then(({ getDb }) => {
    const db = getDb();
    const groups = db.prepare('SELECT * FROM fb_groups WHERE status = \\'ACTIVE\\'').all();
    console.log('Running scrape for', groups.length, 'groups...');
    runScrapeCycle(groups).then(stats => {
      console.log('\\nScrape complete!');
      console.log('Stats:', stats);
    });
  });
}).catch(e => console.error('Error:', e.message));
"
```

**This will:**
- Open browser (Chrome)
- Navigate to each active group
- Search for keywords within the group
- Extract posts and comments
- Classify comments using LLM (if AWS credentials configured)
- Save leads to database

---

## Messenger Bot Test

### Test 4: Check Messenger Bot (requires leads first)
```bash
cd /Users/anish/Desktop/cos448

# First, export leads to CSV
cd pipeline
node -e "
import('./fb-finder/lead-exporter.js').then(({ exportLeadsToCSV }) => {
  const csvPath = exportLeadsToCSV();
  console.log('Leads exported to:', csvPath);
}).catch(e => console.error('Error:', e.message));
"

# Then run messenger bot
cd ..
node scripts/fb-review-send.js --config campaign.config.json
```

**Note:** You'll need to create `campaign.config.json` first. Example:
```json
{
  "leadsCsvPath": "./pipeline/leads-export.csv",
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

---

## Configuration Notes

### Current .env Settings (pipeline/.env):
- `TEST_MODE=true` - Bypasses quiet hours and browser locks
- `AUTOPILOT_ENABLE_MESSAGING=false` - Messaging is OFF by default
- `FB_FINDER_DAILY_BUDGET=15.0` - $15/day LLM budget
- `AWS_BEARER_TOKEN_BEDROCK=your-bedrock-token-here` - **NEED TO ADD YOUR TOKEN**

### To add real AWS credentials:
1. Edit `pipeline/.env`
2. Replace `your-bedrock-token-here` with your actual Bedrock token
3. Restart any running processes

---

## Troubleshooting

### If browser doesn't open:
- Make sure Chrome is installed
- Run: `npx playwright install chrome`

### If "No groups" error:
```bash
cd /Users/anish/Desktop/cos448/pipeline
node -e "
import('./db.js').then(({ getDb }) => {
  const db = getDb();
  db.prepare('INSERT INTO fb_groups (group_url, group_name, discovery_source, status) VALUES (?, ?, ?, ?)').run(
    'https://www.facebook.com/groups/YOUR_GROUP_ID',
    'Your Group Name',
    'MANUAL',
    'ACTIVE'
  );
  console.log('Group added!');
});
"
```

### If leads aren't being classified:
- Check AWS credentials in `.env`
- Look for budget exceeded messages
- Check `FB_FINDER_MIN_CONFIDENCE` setting (default 0.7)

---

## Next Steps After Testing

1. **Add real Facebook groups** to target
2. **Configure AWS Bedrock** credentials for LLM classification
3. **Set up autopilot** for continuous operation
4. **Deploy to Railway** for 24/7 operation (see DEPLOYMENT.md)

---

## File Locations

- Database: `pipeline/pipeline.db`
- Screenshots: `test-screenshots/`
- Logs: Terminal output
- Session data: `.session/facebook/`
- Exported leads: `pipeline/leads-export-TIMESTAMP.csv`
