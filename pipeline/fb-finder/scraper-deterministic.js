import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import {
  isPostAlreadyScraped,
  insertScrapedPost,
  insertFbLead,
  updateGroupStats,
  setGroupCooldown,
  startScrapeSession,
  finishScrapeSession,
} from "../db.js";
import { buildKnownUserSet, isDuplicate } from "./dedup.js";
import { SELECTORS, trySelectors, extractFbUserId } from "./selectors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hashText(text) {
  return crypto.createHash("sha256").update((text || "").slice(0, 500)).digest("hex");
}

const LOCK_FILE = path.join(PROJECT_ROOT, config.fbFinder.browserLockFile);

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const stat = fs.statSync(LOCK_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < 30 * 60 * 1000) return false;
  }
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, `${process.pid}\n${new Date().toISOString()}`);
  return true;
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

let _context = null;

async function getBrowserContext() {
  if (_context) return _context;

  const sessionDir = path.resolve(PROJECT_ROOT, config.fbFinder.sessionDir);
  fs.mkdirSync(sessionDir, { recursive: true });

  try {
    _context = await chromium.launchPersistentContext(sessionDir, {
      headless: false,
      viewport: null,
      channel: "chrome",
    });
  } catch {
    _context = await chromium.launchPersistentContext(sessionDir, {
      headless: false,
      viewport: null,
    });
  }

  return _context;
}

async function closeBrowser() {
  if (_context) {
    try { await _context.close(); } catch {}
    _context = null;
  }
}

async function humanScroll(page) {
  const amount = randomInt(400, 900);
  await page.mouse.wheel(0, amount);
  await sleep(randomInt(2000, 5000));
}

/**
 * DETERMINISTIC SCRAPING: Get ALL comments from posts with 5+ comments
 * No LLM classification - just raw extraction
 */
async function scrapeGroupDeterministic(group, knownUsers) {
  const sessionId = startScrapeSession(group.id);
  const stats = { postsScanned: 0, commentsScanned: 0, leadsFound: 0 };
  const seenPostHashes = new Set();

  console.log(`\n🎯 DETERMINISTIC SCRAPE: ${group.group_name}`);
  console.log(`   Strategy: Extract ALL commenters from posts with 5+ comments`);

  let page;
  try {
    const context = await getBrowserContext();
    page = await context.newPage();

    // Navigate to group
    console.log(`   Navigating to group...`);
    await page.goto(group.group_url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(randomInt(3000, 5000));

    // Scroll through feed and find posts
    const maxScrolls = 15;
    for (let scroll = 0; scroll < maxScrolls; scroll++) {
      console.log(`   Scroll ${scroll + 1}/${maxScrolls}...`);

      const postElements = await page.$$('div[role="article"]');
      console.log(`   Found ${postElements.length} post containers`);

      for (const postEl of postElements) {
        try {
          // Get post text
          const textEl = await postEl.$('div[dir="auto"]');
          const postText = textEl ? await textEl.textContent() : "";
          const postHash = hashText(postText);

          if (seenPostHashes.has(postHash)) continue;
          seenPostHashes.add(postHash);

          if (isPostAlreadyScraped(group.id, postHash)) continue;

          stats.postsScanned++;

          // Count comments indicators
          const commentCountEls = await postEl.$$('[aria-label*="comment"]');
          let commentCount = 0;

          for (const el of commentCountEls) {
            const label = await el.getAttribute('aria-label').catch(() => '');
            const match = label.match(/(\d+)\s+comment/i);
            if (match) {
              commentCount = Math.max(commentCount, parseInt(match[1]));
            }
          }

          console.log(`   Post #${stats.postsScanned}: ${commentCount} comments`);

          // Only process if 5+ comments
          if (commentCount < 5) continue;

          console.log(`   ✓ Post has ${commentCount} comments - extracting ALL`);

          // Try to expand "View more comments"
          try {
            const moreComments = await postEl.$('span:has-text("View more comments")') ||
                                 await postEl.$('span:has-text("View previous comments")') ||
                                 await postEl.$('[aria-label*="View more comments"]');
            if (moreComments) {
              await moreComments.click({ delay: randomInt(30, 120) });
              await sleep(randomInt(2000, 3000));
              console.log(`   Expanded comments`);
            }
          } catch {}

          // Extract ALL comment authors
          const commentElements = await postEl.$$('div[role="article"]');
          console.log(`   Visible comment elements: ${commentElements.length}`);

          for (const commentEl of commentElements) {
            try {
              const commentTextEl = await commentEl.$('div[dir="auto"] span') ||
                                    await commentEl.$('div[dir="auto"]');
              const commentText = commentTextEl ? await commentTextEl.textContent() : "";
              if (!commentText || commentText.length < 5) continue;

              stats.commentsScanned++;

              const linkEl = await commentEl.$('a[href*="/profile.php"]') ||
                             await commentEl.$('a[href*="facebook.com/"][role="link"]');
              if (!linkEl) continue;

              const profileUrl = await linkEl.getAttribute("href");
              const commenterName = await linkEl.textContent().catch(() => "");
              const fbUserId = extractFbUserId(profileUrl);

              if (!fbUserId) continue;
              if (isDuplicate(fbUserId, knownUsers)) continue;

              // NO LLM - just add everyone
              const messageUrl = `https://www.facebook.com/messages/t/${fbUserId}`;
              insertFbLead({
                fbUserId,
                name: commenterName.trim() || "Unknown",
                profileUrl: profileUrl.startsWith("http") ? profileUrl : `https://www.facebook.com${profileUrl}`,
                messageUrl,
                sourceGroupId: group.id,
                sourceCommentText: commentText.slice(0, 500),
                classificationReason: "Commented on post with 5+ comments",
                classificationConfidence: 1.0,
              });

              knownUsers.add(fbUserId);
              stats.leadsFound++;
              console.log(`   ✓ Lead #${stats.leadsFound}: ${commenterName.trim()}`);
            } catch (err) {
              if (!err.message.includes("Target closed")) {
                console.error(`   Comment error: ${err.message}`);
              }
            }
          }

          // Mark post as scraped
          insertScrapedPost({
            groupId: group.id,
            postUrl: null,
            postAuthor: null,
            postTextHash: postHash,
            postTimestamp: null,
          });

        } catch (err) {
          if (err.message.includes("Target closed")) throw err;
        }
      }

      await humanScroll(page);
    }

    updateGroupStats(group.id, stats);
    setGroupCooldown(group.id, 120);
    finishScrapeSession(sessionId, { ...stats, status: "COMPLETED" });

    console.log(`\n   ✅ Done: ${stats.postsScanned} posts, ${stats.commentsScanned} comments, ${stats.leadsFound} leads`);

  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    finishScrapeSession(sessionId, { ...stats, error: err.message, status: "ERROR" });
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }

  return stats;
}

/**
 * Run deterministic scrape cycle
 */
export async function runDeterministicScrape(groups) {
  const cycleStats = { postsScanned: 0, commentsScanned: 0, leadsFound: 0 };

  if (groups.length === 0) {
    console.log("No groups to scrape");
    return cycleStats;
  }

  console.log(`\n🚀 DETERMINISTIC SCRAPER`);
  console.log(`   Mode: Extract ALL commenters (no LLM filtering)`);
  console.log(`   Threshold: Posts with 5+ comments only`);
  console.log(`   Groups: ${groups.length}\n`);

  if (!acquireLock()) {
    console.log("Browser lock held, skipping");
    return cycleStats;
  }

  const knownUsers = buildKnownUserSet();
  console.log(`Known users: ${knownUsers.size}`);

  try {
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      console.log(`\n[${ i + 1}/${groups.length}] ${group.group_name || group.group_url}`);

      const groupStats = await scrapeGroupDeterministic(group, knownUsers);
      cycleStats.postsScanned += groupStats.postsScanned;
      cycleStats.commentsScanned += groupStats.commentsScanned;
      cycleStats.leadsFound += groupStats.leadsFound;

      if (i < groups.length - 1) {
        const delay = randomInt(30000, 60000);
        console.log(`\n   Waiting ${Math.round(delay / 1000)}s before next group...`);
        await sleep(delay);
      }
    }
  } finally {
    try {
      await closeBrowser();
    } catch {}
    releaseLock();
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ SCRAPE COMPLETE`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Posts scanned: ${cycleStats.postsScanned}`);
  console.log(`Comments scanned: ${cycleStats.commentsScanned}`);
  console.log(`Leads found: ${cycleStats.leadsFound}`);

  return cycleStats;
}
