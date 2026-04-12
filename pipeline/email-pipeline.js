/**
 * Email Pipeline - Scheduling, Reminders, Follow-ups
 *
 * This module runs ONLY the email/scheduling automation:
 * - Detects form signups from Google Sheets
 * - Schedules meetings via Google Calendar
 * - Sends email reminders
 * - Sends post-meeting follow-ups
 *
 * NO Facebook scraping or browser automation.
 * Safe to deploy to Railway or other cloud platforms.
 */

import "dotenv/config";
import cron from "node-cron";
import { getDb } from "./db.js";
import { buildAuthClient } from "./google/auth.js";
import { runDetectSignups } from "./jobs/detect-signups.js";
import { runSchedule } from "./jobs/schedule.js";
import { runRemind } from "./jobs/remind.js";
import { runFollowup } from "./jobs/followup.js";

// Initialize DB (creates tables if needed)
getDb();

// Build Google auth client
const auth = buildAuthClient();

// Verify auth works on startup
try {
  const { token } = await auth.getAccessToken();
  if (token) {
    console.log("✓ Google auth verified successfully.");
  }
} catch (err) {
  console.error("⚠️  WARNING: Google auth failed. Run 'npm run reauth' to re-authorize with needed scopes.");
  console.error("Error:", err.message);
  console.error("The pipeline will start but jobs may fail until auth is fixed.\n");
}

console.log("\n📧 EMAIL PIPELINE MODE");
console.log("=" .repeat(60));
console.log("Running: Scheduling, Reminders, Follow-ups");
console.log("Not running: FB scraping (use fb-pipeline.js for that)");
console.log("=" .repeat(60));

// --- Email/Scheduling Cron Jobs ---

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

console.log("\nActive Jobs:");
console.log("  - Detect signups:    every 5 min");
console.log("  - Schedule meets:    every 5 min (offset)");
console.log("  - Send reminders:    every 10 min");
console.log("  - Send follow-ups:   every 30 min");
console.log("\nPress Ctrl+C to stop.\n");

// Run detection once immediately on startup
console.log("Running initial signup detection...");
runDetectSignups(auth);
