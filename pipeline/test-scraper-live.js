/**
 * Live scraper test — verifies the keyword-search-within-groups flow
 * with screenshots at every major step.
 *
 * Run:  node test-scraper-live.js
 *
 * What it does:
 *   1. Picks the first ACTIVE group from the DB
 *   2. Opens Facebook in Chrome (using saved session)
 *   3. Screenshots the group's main feed
 *   4. For each of 3 keywords:
 *      a. Navigates to groups/{slug}/search/?q={keyword}
 *      b. Screenshots the search results page
 *      c. Tries to click "Recent" sort
 *      d. Screenshots after sort
 *      e. Counts visible post containers
 *   5. Prints a DB diff showing what keyword searches were recorded
 */

import "dotenv/config";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db.js";
import { pickSearchKeywords } from "./fb-finder/scraper.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "test-screenshots");
const SESSION_DIR = path.resolve(PROJECT_ROOT, config.fbFinder.sessionDir);

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

async function screenshot(page, label) {
  const filename = `${Date.now()}-${label.replace(/[^a-z0-9]+/gi, "-")}.png`;
  const fullPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  log(`  📸 Screenshot: test-screenshots/${filename}`);
  return filename;
}

async function main() {
  const db = getDb();

  // --- Pick a group ---
  const group = db.prepare(`
    SELECT * FROM fb_groups
    WHERE status = 'ACTIVE'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();

  if (!group) {
    console.error("No active groups in DB. Run group discovery first.");
    process.exit(1);
  }

  log(`\nTarget group: ${group.group_name || group.group_url}`);
  log(`Group ID: ${group.id}`);
  log(`URL: ${group.group_url}`);

  // Pick keywords for this group
  const keywords = pickSearchKeywords(group.id, 3);
  log(`Keywords to test: [${keywords.join(", ")}]\n`);

  // --- Launch browser ---
  log("Launching browser with saved Facebook session...");
  fs.mkdirSync(SESSION_DIR, { recursive: true });

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

  const results = [];

  try {
    // ----------------------------------------------------------------
    // Step 1: Load group main feed (baseline)
    // ----------------------------------------------------------------
    log("\n[Step 1] Loading group main feed...");
    const groupSlug = group.group_url.replace(/\/$/, "").split("/").pop();

    await page.goto(group.group_url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(randomInt(2000, 3000));

    const feedShot = await screenshot(page, `1-group-main-feed`);
    const feedTitle = await page.title().catch(() => "unknown");
    log(`  Page title: ${feedTitle}`);

    // Count post containers on main feed
    const feedPosts = await page.$$('div[role="article"]');
    log(`  Visible post containers on main feed: ${feedPosts.length}`);

    results.push({
      step: "Main feed",
      url: group.group_url,
      postsVisible: feedPosts.length,
      screenshot: feedShot,
    });

    // ----------------------------------------------------------------
    // Step 2: For each keyword, navigate to in-group search
    // ----------------------------------------------------------------
    for (let ki = 0; ki < keywords.length; ki++) {
      const keyword = keywords[ki];
      const stepNum = ki + 2;

      log(`\n[Step ${stepNum}] Keyword search: "${keyword}"`);

      const searchUrl = `https://www.facebook.com/groups/${groupSlug}/search/?q=${encodeURIComponent(keyword)}`;
      log(`  URL: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(randomInt(2500, 4000));

      const searchShot = await screenshot(page, `${stepNum}a-search-${keyword.replace(/\s+/g, "_")}-before-sort`);
      const searchTitle = await page.title().catch(() => "unknown");
      log(`  Page title: ${searchTitle}`);

      // Count posts before sort
      const postsBeforeSort = await page.$$('div[role="article"]');
      log(`  Posts visible before sort: ${postsBeforeSort.length}`);

      // Check page URL actually changed to search
      const currentUrl = page.url();
      const isSearchUrl = currentUrl.includes("/search/");
      log(`  URL is search URL: ${isSearchUrl} → ${currentUrl.slice(0, 80)}`);

      // Try clicking "Recent" sort
      let sortClicked = false;
      try {
        const recentEl =
          await page.$('a:has-text("Recent")') ||
          await page.$('span:has-text("Recent posts")') ||
          await page.$('[aria-label*="Recent"]') ||
          await page.$('div[role="tab"]:has-text("Recent")');

        if (recentEl) {
          await recentEl.click({ delay: randomInt(30, 100) });
          await sleep(randomInt(1500, 2500));
          sortClicked = true;
          log(`  ✓ Clicked "Recent" sort`);
        } else {
          log(`  ⚠ No "Recent" sort button found (may already be on Recent, or not available)`);
        }
      } catch (err) {
        log(`  ⚠ Sort click error: ${err.message}`);
      }

      await sleep(1000);
      const sortShot = await screenshot(page, `${stepNum}b-search-${keyword.replace(/\s+/g, "_")}-after-sort`);

      // Count posts after sort
      const postsAfterSort = await page.$$('div[role="article"]');
      log(`  Posts visible after sort: ${postsAfterSort.length}`);

      // Check for any text content in the posts
      let samplePostText = "";
      if (postsAfterSort.length > 0) {
        try {
          const textEl = await postsAfterSort[0].$('div[dir="auto"]');
          samplePostText = textEl ? (await textEl.textContent()).slice(0, 100) : "";
          if (samplePostText) log(`  Sample post text: "${samplePostText.trim().slice(0, 80)}..."`);
        } catch { /* ignore */ }
      }

      // Check for "No results" indicators
      const noResults =
        await page.$('span:has-text("No results")') ||
        await page.$('span:has-text("No posts")') ||
        await page.$('[data-testid="empty_search"]');
      if (noResults) {
        log(`  ⚠ "No results" indicator found for keyword "${keyword}"`);
      }

      results.push({
        step: `Keyword: "${keyword}"`,
        url: searchUrl,
        isSearchUrl,
        sortClicked,
        postsBeforeSort: postsBeforeSort.length,
        postsAfterSort: postsAfterSort.length,
        noResults: !!noResults,
        screenshotBefore: searchShot,
        screenshotAfter: sortShot,
      });

      // Simulate recording the keyword search in DB (as the real scraper would)
      db.prepare(`
        INSERT INTO fb_keyword_searches (group_id, keyword, posts_found, leads_found)
        VALUES (?, ?, ?, ?)
      `).run(group.id, keyword, postsAfterSort.length, 0);
      log(`  ✓ Recorded keyword search in DB: "${keyword}" → ${postsAfterSort.length} posts`);

      await sleep(randomInt(2000, 3000));
    }

    // ----------------------------------------------------------------
    // Step 3: Verify DB recorded keyword searches
    // ----------------------------------------------------------------
    log("\n[Step Final] Verifying DB keyword search records...");
    const dbSearches = db.prepare(`
      SELECT keyword, posts_found, leads_found, searched_at
      FROM fb_keyword_searches
      WHERE group_id = ?
      ORDER BY searched_at DESC
    `).all(group.id);

    log(`  DB records for group ${group.id}:`);
    for (const s of dbSearches) {
      log(`    "${s.keyword}" → ${s.posts_found} posts, ${s.leads_found} leads (${s.searched_at})`);
    }

  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  // ----------------------------------------------------------------
  // Print summary
  // ----------------------------------------------------------------
  console.log(`\n${"=".repeat(60)}`);
  console.log("TEST SUMMARY");
  console.log(`${"=".repeat(60)}`);
  console.log(`Group: ${group.group_name || group.group_url}`);
  console.log(`Keywords tested: ${keywords.join(", ")}`);
  console.log(`Screenshots saved to: test-screenshots/\n`);

  for (const r of results) {
    console.log(`--- ${r.step} ---`);
    if (r.postsVisible !== undefined) {
      console.log(`  Posts on main feed: ${r.postsVisible}`);
    }
    if (r.isSearchUrl !== undefined) {
      console.log(`  Navigated to search URL: ${r.isSearchUrl}`);
      console.log(`  Sort-by-Recent clicked: ${r.sortClicked}`);
      console.log(`  Posts before sort: ${r.postsBeforeSort}`);
      console.log(`  Posts after sort:  ${r.postsAfterSort}`);
      console.log(`  No results page:   ${r.noResults}`);
    }
    console.log();
  }

  console.log(`All screenshots:`);
  const shots = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith(".png")).sort();
  for (const f of shots) console.log(`  test-screenshots/${f}`);
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
