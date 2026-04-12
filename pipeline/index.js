import "dotenv/config";
import cron from "node-cron";
import { getDb } from "./db.js";
import { buildAuthClient } from "./google/auth.js";
import { runDetectSignups } from "./jobs/detect-signups.js";
import { runSchedule } from "./jobs/schedule.js";
import { runRemind } from "./jobs/remind.js";
import { runFollowup } from "./jobs/followup.js";
import { runScrapeGroups } from "./jobs/scrape-groups.js";
import { runDiscoverGroups } from "./jobs/discover-groups.js";
import { runExportLeads } from "./jobs/export-leads.js";

// Initialize DB (creates tables if needed)
getDb();

// Build Google auth client
const auth = buildAuthClient();

// Verify auth works on startup
try {
  const { token } = await auth.getAccessToken();
  if (token) {
    console.log("Google auth verified successfully.");
  }
} catch (err) {
  console.error("WARNING: Google auth failed. Run 'npm run reauth' to re-authorize with needed scopes.");
  console.error("Error:", err.message);
  console.error("The pipeline will start but jobs may fail until auth is fixed.\n");
}

// --- Cron jobs ---

// Detect new signups: every 5 minutes
cron.schedule("*/5 * * * *", () => {
  console.log(`[${new Date().toLocaleTimeString()}] Running signup detection...`);
  runDetectSignups(auth);
});

// Schedule meetings: every 5 minutes (offset by 2 min)
cron.schedule("2-59/5 * * * *", () => {
  console.log(`[${new Date().toLocaleTimeString()}] Running scheduler...`);
  runSchedule(auth);
});

// Send reminders: every 10 minutes
cron.schedule("*/10 * * * *", () => {
  console.log(`[${new Date().toLocaleTimeString()}] Checking reminders...`);
  runRemind(auth);
});

// Post-meeting follow-ups: every 30 minutes
cron.schedule("*/30 * * * *", () => {
  console.log(`[${new Date().toLocaleTimeString()}] Checking follow-ups...`);
  runFollowup(auth);
});

// --- FB Lead Finder cron jobs ---

// Scrape groups: 3x/day at 7am, 11am, 3pm (avoids messenger bot's evening hours)
cron.schedule("0 7,11,15 * * *", () => {
  console.log(`[${new Date().toLocaleTimeString()}] Running group scrape...`);
  runScrapeGroups();
});

// Discover new groups: daily at 5am
cron.schedule("0 5 * * *", () => {
  console.log(`[${new Date().toLocaleTimeString()}] Running group discovery...`);
  runDiscoverGroups();
});

// Export leads to CSV: every 2 hours
cron.schedule("30 */2 * * *", () => {
  console.log(`[${new Date().toLocaleTimeString()}] Running lead export...`);
  runExportLeads();
});

console.log("\nPipeline daemon started.");
console.log("Jobs:");
console.log("  - Detect signups:    every 5 min");
console.log("  - Schedule meets:    every 5 min (offset)");
console.log("  - Send reminders:    every 10 min");
console.log("  - Send follow-ups:   every 30 min");
console.log("  - Scrape FB groups:  3x/day (7am, 11am, 3pm)");
console.log("  - Discover groups:   daily at 5am");
console.log("  - Export leads:      every 2 hours");
console.log("\nPress Ctrl+C to stop.\n");

// Run detection once immediately on startup
console.log("Running initial signup detection...");
runDetectSignups(auth);
