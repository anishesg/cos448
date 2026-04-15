#!/usr/bin/env node
/**
 * Quick test to verify FB bot is ready
 */

import "dotenv/config";
import { chromium } from "playwright";
import { getDb } from "./db.js";
import { config } from "./config.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SESSION_DIR = path.resolve(PROJECT_ROOT, config.fbFinder.sessionDir);

async function main() {
  console.log("🧪 FB Outreach Bot - Quick Test\n");

  // Test 1: Database
  console.log("1️⃣  Testing database...");
  const db = getDb();
  const groups = db.prepare('SELECT COUNT(*) as count FROM fb_groups').get();
  const leads = db.prepare('SELECT COUNT(*) as count FROM fb_leads').get();
  console.log(`   ✓ Database OK`);
  console.log(`   - Groups: ${groups.count}`);
  console.log(`   - Leads: ${leads.count}\n`);

  // Test 2: Playwright
  console.log("2️⃣  Testing Playwright...");
  fs.mkdirSync(SESSION_DIR, { recursive: true });

  let context;
  try {
    console.log("   Opening browser (this will take a few seconds)...");
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: false,
      viewport: null,
      channel: "chrome",
    }).catch(() => {
      return chromium.launchPersistentContext(SESSION_DIR, {
        headless: false,
        viewport: null,
      });
    });

    console.log("   ✓ Browser opened successfully");

    const page = await context.newPage();
    console.log("   ✓ New page created");

    // Navigate to Facebook
    console.log("   Navigating to Facebook...");
    await page.goto("https://www.facebook.com", {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });

    console.log("   ✓ Facebook loaded");

    const title = await page.title();
    console.log(`   Page title: "${title}"`);

    // Check if logged in
    const isLoggedIn = !title.toLowerCase().includes("log in") &&
                       !title.toLowerCase().includes("sign up");

    if (isLoggedIn) {
      console.log("   ✓ Already logged into Facebook\n");
    } else {
      console.log("   ⚠️  Not logged in - you'll need to log in manually");
      console.log("   The browser will stay open for 30 seconds so you can log in...\n");
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    console.log("3️⃣  Closing browser...");
    await page.close();
    await context.close();
    console.log("   ✓ Browser closed\n");

  } catch (error) {
    console.error("   ✗ Error:", error.message);
    if (context) {
      await context.close().catch(() => {});
    }
    process.exit(1);
  }

  console.log("✅ All tests passed!");
  console.log("\n📝 Next steps:");
  console.log("   1. Run 'node test-scraper-live.js' to test full scraping");
  console.log("   2. Make sure you're logged into Facebook in the browser");
  console.log("   3. Add AWS Bedrock credentials to .env for LLM classification");
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
