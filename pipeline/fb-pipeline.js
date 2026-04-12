/**
 * FB Lead Finder Pipeline - Scraping, Classification, Autopilot
 *
 * This module runs ONLY the Facebook lead generation automation:
 * - Scrapes Facebook groups for leads
 * - LLM classification via AWS Bedrock
 * - Group discovery and management
 * - Lead export to CSV
 * - Optional autopilot mode (run autopilot.js instead)
 *
 * Requires Playwright/browser automation.
 * Run this LOCALLY only (not on Railway).
 */

import "dotenv/config";
import cron from "node-cron";
import { getDb } from "./db.js";
import { runScrapeGroups } from "./jobs/scrape-groups.js";
import { runDiscoverGroups } from "./jobs/discover-groups.js";
import { runExportLeads } from "./jobs/export-leads.js";

// Initialize DB (creates tables if needed)
getDb();

console.log("\n🔍 FB LEAD FINDER PIPELINE");
console.log("=" .repeat(60));
console.log("Running: Group scraping, Discovery, Lead export");
console.log("Not running: Email scheduling (use email-pipeline.js for that)");
console.log("=" .repeat(60));

// --- FB Lead Finder Cron Jobs ---

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

console.log("\nActive Jobs:");
console.log("  - Scrape FB groups:  3x/day (7am, 11am, 3pm)");
console.log("  - Discover groups:   daily at 5am");
console.log("  - Export leads:      every 2 hours");
console.log("\n💡 For autonomous operation, use 'node autopilot.js' instead");
console.log("\nPress Ctrl+C to stop.\n");
