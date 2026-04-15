#!/usr/bin/env node
/**
 * Open browser, wait for login, then run full test
 */

import "dotenv/config";
import { chromium } from "playwright";
import { getDb } from "./db.js";
import { pickSearchKeywords } from "./fb-finder/scraper.js";
import { config } from "./config.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SESSION_DIR = path.resolve(PROJECT_ROOT, config.fbFinder.sessionDir);
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "test-screenshots");

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(SESSION_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function screenshot(page, label) {
  const filename = `${Date.now()}-${label.replace(/[^a-z0-9]+/gi, "-")}.png`;
  const fullPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  console.log(`  📸 Screenshot: test-screenshots/${filename}`);
  return filename;
}

async function main() {
  console.log("🚀 FB Outreach Bot - Login & Test\n");

  // Launch browser
  console.log("1️⃣  Opening browser...");
  let context;
  try {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: false,
      viewport: null,
      channel: "chrome",
    });
  } catch {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: false,
      viewport: null,
    });
  }

  const page = await context.newPage();
  console.log("   ✓ Browser opened\n");

  // Navigate to Facebook
  console.log("2️⃣  Navigating to Facebook...");
  await page.goto("https://www.facebook.com", {
    waitUntil: "domcontentloaded",
    timeout: 15000
  });

  const title = await page.title();
  console.log(`   Page title: "${title}"`);

  const isLoggedIn = !title.toLowerCase().includes("log in") &&
                     !title.toLowerCase().includes("sign up");

  if (isLoggedIn) {
    console.log("   ✅ Already logged in!\n");
  } else {
    console.log("   ⚠️  Not logged in");
    console.log("\n" + "=".repeat(60));
    console.log("👉 Please log into Facebook in the browser window");
    console.log("=".repeat(60));
  }

  // Wait for user confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  await new Promise(resolve => {
    rl.question("\n✋ Press ENTER when you're logged in and ready to start scraping...", () => {
      rl.close();
      resolve();
    });
  });

  console.log("\n3️⃣  Starting scraping test...\n");

  // Get group from database
  const db = getDb();
  const group = db.prepare(`
    SELECT * FROM fb_groups
    WHERE status = 'ACTIVE'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();

  if (!group) {
    console.error("❌ No active groups in DB");
    await context.close();
    process.exit(1);
  }

  console.log(`Target: ${group.group_name || group.group_url}`);
  const keywords = pickSearchKeywords(group.id, 3);
  console.log(`Keywords: [${keywords.join(", ")}]\n`);

  const results = [];

  try {
    // Test main feed
    console.log("[Step 1] Loading group main feed...");
    await page.goto(group.group_url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(randomInt(2000, 3000));

    const feedShot = await screenshot(page, "1-main-feed");
    const feedPosts = await page.$$('div[role="article"]');
    console.log(`  Posts visible: ${feedPosts.length}\n`);

    results.push({
      step: "Main feed",
      posts: feedPosts.length,
      screenshot: feedShot
    });

    // Test keyword searches
    const groupSlug = group.group_url.replace(/\/$/, "").split("/").pop();

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      const stepNum = i + 2;

      console.log(`[Step ${stepNum}] Searching "${keyword}"...`);
      const searchUrl = `https://www.facebook.com/groups/${groupSlug}/search/?q=${encodeURIComponent(keyword)}`;

      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(randomInt(2500, 4000));

      const searchShot = await screenshot(page, `${stepNum}-search-${keyword}`);
      const posts = await page.$$('div[role="article"]');
      console.log(`  Posts found: ${posts.length}`);

      // Try to click Recent sort
      try {
        const recentEl = await page.$('a:has-text("Recent")') ||
                        await page.$('span:has-text("Recent posts")') ||
                        await page.$('[aria-label*="Recent"]');
        if (recentEl) {
          await recentEl.click({ delay: randomInt(30, 100) });
          await sleep(randomInt(1500, 2500));
          console.log(`  ✓ Sorted by recent`);
        }
      } catch (err) {
        console.log(`  ⚠️  Sort not available`);
      }

      const afterSort = await page.$$('div[role="article"]');
      console.log(`  Posts after sort: ${afterSort.length}`);

      // Record in database
      db.prepare(`
        INSERT INTO fb_keyword_searches (group_id, keyword, posts_found, leads_found)
        VALUES (?, ?, ?, ?)
      `).run(group.id, keyword, afterSort.length, 0);

      results.push({
        step: `Search: "${keyword}"`,
        posts: afterSort.length,
        screenshot: searchShot
      });

      console.log(`  ✓ Recorded\n`);
      await sleep(randomInt(2000, 3000));
    }

  } finally {
    console.log("\n4️⃣  Closing browser...");
    await page.close();
    await context.close();
    console.log("   ✓ Closed\n");
  }

  // Summary
  console.log("=".repeat(60));
  console.log("✅ TEST COMPLETE");
  console.log("=".repeat(60));
  console.log(`Group: ${group.group_name}`);
  console.log(`Keywords: ${keywords.join(", ")}`);
  console.log(`Screenshots: test-screenshots/\n`);

  for (const r of results) {
    console.log(`${r.step} → ${r.posts} posts`);
  }

  console.log("\n📊 Database updated with keyword search results");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
