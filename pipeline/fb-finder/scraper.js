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
  getRecentKeywordSearches,
  recordKeywordSearch,
  getTopSearchKeywords,
} from "../db.js";
import { classifyComment, isBudgetExceeded } from "./classifier.js";
import { buildKnownUserSet, isDuplicate } from "./dedup.js";
import { SELECTORS, trySelectors, extractFbUserId, parseRelativeTimestamp } from "./selectors.js";
import { evaluateGroupHealth } from "./group-manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ARTIFACTS_DIR = path.join(PROJECT_ROOT, "artifacts");

// In-group search keywords — short, high-signal terms that surface relevant posts.
// These get supplemented by LLM-generated keywords stored in autopilot_keywords.
const SEED_SEARCH_KEYWORDS = [
  "SAT",
  "ACT",
  "college",
  "admissions",
  "essay",
  "research",
  "extracurricular",
  "AP",
  "tutor",
  "counselor",
  "junior",
  "sophomore",
  "university",
  "application",
  "GPA",
  "recommendation",
  "internship",
  "summer program",
  "Ivy",
  "prep",
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hashText(text) {
  return crypto.createHash("sha256").update((text || "").slice(0, 500)).digest("hex");
}

// --- Browser Lock ---

const LOCK_FILE = path.join(PROJECT_ROOT, config.fbFinder.browserLockFile);
const LOCK_STALE_MS = 30 * 60 * 1000;

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const stat = fs.statSync(LOCK_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < LOCK_STALE_MS) {
      return false;
    }
    console.log("Stale browser lock detected, removing...");
  }
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  fs.writeFileSync(LOCK_FILE, `${process.pid}\n${new Date().toISOString()}`);
  return true;
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // Already removed
  }
}

// --- Browser Session ---

let _context = null;

async function getBrowserContext() {
  if (_context) return _context;

  const sessionDir = path.resolve(PROJECT_ROOT, config.fbFinder.sessionDir);
  fs.mkdirSync(sessionDir, { recursive: true });

  const options = {
    headless: false,
    viewport: null,
  };

  try {
    _context = await chromium.launchPersistentContext(sessionDir, {
      ...options,
      channel: "chrome",
    });
  } catch {
    _context = await chromium.launchPersistentContext(sessionDir, options);
  }

  return _context;
}

async function closeBrowser() {
  if (_context) {
    try {
      await _context.close();
    } catch {
      // Ignore close errors
    }
    _context = null;
  }
}

// --- Anti-detection helpers ---

async function randomMouseMove(page) {
  const x = randomInt(100, 800);
  const y = randomInt(200, 600);
  await page.mouse.move(x, y, { steps: randomInt(3, 8) });
}

async function humanScroll(page, { slow = false } = {}) {
  const amount = randomInt(400, 900);
  await page.mouse.wheel(0, amount);
  await randomMouseMove(page);
  const baseWait = slow ? randomInt(4000, 8000) : randomInt(2000, 5000);
  await sleep(baseWait);
}

// --- Keyword selection ---

/**
 * Pick keywords to search within a group, prioritizing ones not recently used
 * for this group. Mixes seed keywords with any LLM-generated ones from the DB.
 */
export function pickSearchKeywords(groupId, count = 5) {
  const recentSearches = getRecentKeywordSearches(groupId, 48);
  const recentlyUsed = new Set(recentSearches.map((r) => r.keyword.toLowerCase()));

  // Gather LLM-generated in-group search keywords from the DB
  let dbSearchKeywords = [];
  try {
    dbSearchKeywords = (getTopSearchKeywords(30) || []).map((k) => k.keyword);
  } catch {
    // Table may not exist yet
  }

  const allKeywords = [...new Set([...SEED_SEARCH_KEYWORDS, ...dbSearchKeywords])];

  const fresh = allKeywords.filter((k) => !recentlyUsed.has(k.toLowerCase()));
  const stale = allKeywords.filter((k) => recentlyUsed.has(k.toLowerCase()));

  const shuffled = [...fresh.sort(() => Math.random() - 0.5), ...stale.sort(() => Math.random() - 0.5)];
  return shuffled.slice(0, count);
}

// --- Post & comment extraction (shared between search and feed modes) ---

async function extractPostsAndClassify(page, group, knownUsers, stats, seenPostHashes, maxPostAge, minClassificationConfidence) {
  const postElements = await trySelectors(page, SELECTORS.POST_CONTAINER, { all: true, timeout: 5000 });
  let newPostsFound = 0;

  for (const postEl of postElements) {
    try {
      const textEl = await postEl.$('div[dir="auto"]');
      const postText = textEl ? await textEl.textContent() : "";
      const postHash = hashText(postText);

      if (seenPostHashes.has(postHash)) continue;
      seenPostHashes.add(postHash);

      if (isPostAlreadyScraped(group.id, postHash)) continue;

      const timestampEl = await postEl.$('a[role="link"] span[id] > span') ||
                          await postEl.$('abbr[data-utime]') ||
                          await postEl.$('a[aria-label*="ago"]');
      if (timestampEl) {
        const tsText = await timestampEl.textContent().catch(() => "");
        const postDate = parseRelativeTimestamp(tsText);
        if (postDate && postDate < maxPostAge) continue;
      }

      insertScrapedPost({
        groupId: group.id,
        postUrl: null,
        postAuthor: null,
        postTextHash: postHash,
        postTimestamp: null,
      });
      stats.postsScanned++;
      newPostsFound++;

      // Expand comments
      try {
        const moreComments = await postEl.$('span:has-text("View more comments")') ||
                             await postEl.$('span:has-text("View previous comments")');
        if (moreComments) {
          await moreComments.click({ delay: randomInt(30, 120) });
          await sleep(randomInt(1000, 2000));
        }
      } catch {
        // Comments expansion failed
      }

      // Extract and classify comments
      const commentElements = await postEl.$$('div[role="article"]');
      for (const commentEl of commentElements) {
        try {
          const commentTextEl = await commentEl.$('div[dir="auto"] span') ||
                                await commentEl.$('div[dir="auto"]');
          const commentText = commentTextEl ? await commentTextEl.textContent() : "";
          if (!commentText || commentText.length < 10) continue;

          stats.commentsScanned++;

          const linkEl = await commentEl.$('a[href*="/profile.php"]') ||
                         await commentEl.$('a[href*="facebook.com/"][role="link"]');
          if (!linkEl) continue;

          const profileUrl = await linkEl.getAttribute("href");
          const commenterName = await linkEl.textContent().catch(() => "");
          const fbUserId = extractFbUserId(profileUrl);

          if (!fbUserId) continue;
          if (isDuplicate(fbUserId, knownUsers)) continue;

          if (isBudgetExceeded()) {
            console.log("  LLM budget exceeded, skipping remaining classifications");
            return newPostsFound;
          }

          stats.llmCalls++;
          const classification = await classifyComment(commentText, postText.slice(0, 200));
          stats.llmCostUsd += (classification.tokens.input * 0.035 + classification.tokens.output * 0.14) / 1_000_000;

          if (classification.isLead && classification.confidence >= minClassificationConfidence) {
            const messageUrl = `https://www.facebook.com/messages/t/${fbUserId}`;
            insertFbLead({
              fbUserId,
              name: commenterName.trim() || "Unknown",
              profileUrl: profileUrl.startsWith("http") ? profileUrl : `https://www.facebook.com${profileUrl}`,
              messageUrl,
              sourceGroupId: group.id,
              sourceCommentText: commentText.slice(0, 500),
              classificationReason: classification.reason,
              classificationConfidence: classification.confidence,
            });
            knownUsers.add(fbUserId);
            stats.leadsFound++;
            console.log(`  Lead found: ${commenterName.trim()} (${fbUserId}) — ${classification.reason.slice(0, 60)}`);
          }
        } catch (err) {
          if (!err.message.includes("Target closed")) {
            console.error(`  Comment extraction error: ${err.message}`);
          }
        }
      }
    } catch (err) {
      if (err.message.includes("Target closed")) throw err;
      console.error(`  Post extraction error: ${err.message}`);
    }
  }

  return newPostsFound;
}

// --- Keyword-search-based scraping (primary strategy) ---

/**
 * Search within a group for a specific keyword, sort by most recent, scrape results.
 * Returns number of new posts found.
 */
async function searchGroupByKeyword(page, group, keyword, knownUsers, stats, seenPostHashes, maxPostAge, minClassificationConfidence) {
  // Extract group ID/slug from URL for the search path
  const groupSlug = group.group_url.replace(/\/$/, "").split("/").pop();
  const searchUrl = `https://www.facebook.com/groups/${groupSlug}/search/?q=${encodeURIComponent(keyword)}`;

  console.log(`    Searching "${keyword}" in group...`);
  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (navErr) {
    if (navErr.message.includes("Target closed")) throw navErr;
    console.error(`    Navigation failed for "${keyword}": ${navErr.message}`);
    return 0;
  }
  await sleep(randomInt(2000, 4000));

  // Try to click "Recent Posts" or sort-by-recent filter if available
  try {
    const recentTab = await page.$('a:has-text("Recent")') ||
                      await page.$('span:has-text("Recent posts")') ||
                      await page.$('[aria-label*="Recent"]');
    if (recentTab) {
      await recentTab.click({ delay: randomInt(30, 100) });
      await sleep(randomInt(1500, 3000));
    }
  } catch {
    // Sort filter not available or already on recent
  }

  // Scrape visible results
  let totalNewPosts = 0;
  const maxScrollsPerKeyword = config.fbFinder.maxScrollsPerKeyword || 4;
  let noNewContentCount = 0;

  for (let scroll = 0; scroll < maxScrollsPerKeyword; scroll++) {
    if (isBudgetExceeded()) break;

    const newPosts = await extractPostsAndClassify(
      page, group, knownUsers, stats, seenPostHashes,
      maxPostAge, minClassificationConfidence
    );
    totalNewPosts += newPosts;

    if (newPosts === 0) {
      noNewContentCount++;
      // Be more patient with search results — FB sometimes takes time to render
      if (noNewContentCount >= 3) break;
    } else {
      noNewContentCount = 0;
    }

    await humanScroll(page);
  }

  return totalNewPosts;
}

// --- Core scraping (keyword-search-first strategy) ---

/**
 * Scrape a single group using keyword search:
 * 1. Pick N keywords not recently searched for this group
 * 2. For each keyword, navigate to group/search/?q=keyword
 * 3. Sort by most recent, extract posts/comments, classify
 * 4. Fall back to feed scroll if keyword search yields nothing
 */
export async function scrapeGroup(group, knownUsers) {
  const { maxScrollsPerGroup, maxPostAgeDays, minClassificationConfidence, cooldownMinutes, keywordsPerGroup } = config.fbFinder;
  const sessionId = startScrapeSession(group.id);
  const stats = { postsScanned: 0, commentsScanned: 0, leadsFound: 0, llmCalls: 0, llmCostUsd: 0 };
  const maxPostAge = new Date();
  maxPostAge.setDate(maxPostAge.getDate() - maxPostAgeDays);
  const seenPostHashes = new Set();

  let page;
  try {
    const context = await getBrowserContext();
    page = await context.newPage();

    // --- Phase 1: Keyword search (primary strategy) ---
    const keywords = pickSearchKeywords(group.id, keywordsPerGroup || 5);
    console.log(`  Keywords: [${keywords.join(", ")}]`);

    for (const keyword of keywords) {
      if (isBudgetExceeded()) {
        console.log("  LLM budget exceeded, stopping scrape");
        break;
      }

      const leadsBefore = stats.leadsFound;
      try {
        const newPosts = await searchGroupByKeyword(
          page, group, keyword, knownUsers, stats, seenPostHashes,
          maxPostAge, minClassificationConfidence
        );
        const leadsFromKeyword = stats.leadsFound - leadsBefore;
        recordKeywordSearch(group.id, keyword, newPosts, leadsFromKeyword);
        console.log(`    "${keyword}" → ${newPosts} new posts, ${leadsFromKeyword} leads`);
      } catch (err) {
        if (err.message.includes("Target closed")) throw err;
        console.error(`    Search error for "${keyword}": ${err.message}`);
      }

      await sleep(randomInt(2000, 5000));
    }

    // --- Phase 2: Feed scroll fallback (if keyword search found very little) ---
    if (stats.postsScanned < 3 && !isBudgetExceeded()) {
      console.log(`  Few posts from search (${stats.postsScanned}), falling back to feed scroll...`);
      await page.goto(group.group_url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(randomInt(2000, 4000));

      const feed = await trySelectors(page, SELECTORS.FEED_CONTAINER, { timeout: 10000 });
      if (feed) {
        let noNewContentCount = 0;
        for (let scroll = 0; scroll < maxScrollsPerGroup; scroll++) {
          if (isBudgetExceeded()) break;

          const newPosts = await extractPostsAndClassify(
            page, group, knownUsers, stats, seenPostHashes,
            maxPostAge, minClassificationConfidence
          );

          if (newPosts === 0) {
            noNewContentCount++;
            if (noNewContentCount >= 5) {
              console.log("  No new content after 5 scrolls, stopping feed fallback");
              break;
            }
            await humanScroll(page, { slow: true });
          } else {
            noNewContentCount = 0;
            await humanScroll(page);
          }
        }
      }
    }

    // Update group stats
    updateGroupStats(group.id, stats);
    setGroupCooldown(group.id, cooldownMinutes);
    evaluateGroupHealth(group.id);

    finishScrapeSession(sessionId, { ...stats, status: "COMPLETED" });
    console.log(`  Done: ${stats.postsScanned} posts, ${stats.commentsScanned} comments, ${stats.leadsFound} leads`);

  } catch (err) {
    console.error(`Scrape error for ${group.group_name || group.group_url}: ${err.message}`);
    finishScrapeSession(sessionId, { ...stats, error: err.message, status: "ERROR" });

    if (page) {
      try {
        fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
        const filename = `scrape-error-${group.id}-${Date.now()}.png`;
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, filename) });
        console.log(`  Screenshot saved: artifacts/${filename}`);
      } catch {
        // Screenshot failed
      }
    }
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }

  return stats;
}

/**
 * Resolve a vanity URL to a numeric FB user ID by visiting the profile page.
 */
export async function resolveVanityUrl(page, vanityUrl) {
  try {
    const profileUrl = vanityUrl.startsWith("http") ? vanityUrl : `https://www.facebook.com/${vanityUrl}`;
    await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await sleep(randomInt(1000, 2000));

    const content = await page.content();

    const userIdMatch = content.match(/"userID"\s*:\s*"(\d+)"/);
    if (userIdMatch) return userIdMatch[1];

    const fbMatch = content.match(/content="fb:\/\/profile\/(\d+)"/);
    if (fbMatch) return fbMatch[1];

    const entityMatch = content.match(/"entity_id"\s*:\s*"(\d+)"/);
    if (entityMatch) return entityMatch[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Run a complete scrape cycle for a list of groups.
 * Returns aggregate stats from all groups.
 */
export async function runScrapeCycle(groups) {
  const cycleStats = { postsScanned: 0, commentsScanned: 0, leadsFound: 0, llmCalls: 0, llmCostUsd: 0 };

  if (groups.length === 0) {
    console.log("No groups to scrape");
    return cycleStats;
  }

  const testMode = config.fbFinder.testMode;

  if (testMode) {
    console.log("🧪 TEST MODE ENABLED - All restrictions bypassed");
  }

  const skipQuietHours = process.env.SKIP_QUIET_HOURS === "true" || testMode;
  const hour = new Date().getHours();
  if (!skipQuietHours && (hour >= config.fbFinder.quietHoursStart || hour < config.fbFinder.quietHoursEnd)) {
    console.log(`⏰ Quiet hours active (${config.fbFinder.quietHoursStart}:00-${config.fbFinder.quietHoursEnd}:00)`);
    console.log(`   Current time: ${new Date().toLocaleTimeString()}`);
    console.log(`   Scraping paused to avoid detection. Wait until ${config.fbFinder.quietHoursEnd}:00 AM or enable Test Mode in Settings.`);
    return cycleStats;
  }

  if (!testMode && !acquireLock()) {
    console.log("Browser lock held by another process, skipping");
    console.log("Enable Test Mode in Settings to bypass this restriction.");
    return cycleStats;
  }

  const cycleStart = Date.now();
  const maxBrowsingMs = config.fbFinder.maxBrowsingMinutes * 60 * 1000;
  const knownUsers = buildKnownUserSet();

  console.log(`\nStarting scrape cycle — ${groups.length} groups, ${knownUsers.size} known users`);

  try {
    for (let i = 0; i < groups.length; i++) {
      if (Date.now() - cycleStart > maxBrowsingMs) {
        console.log("Max browsing time reached, stopping cycle");
        break;
      }

      const group = groups[i];
      console.log(`\n[${i + 1}/${groups.length}] Scraping: ${group.group_name || group.group_url} (${group.selectionReason})`);

      const groupStats = await scrapeGroup(group, knownUsers);
      cycleStats.postsScanned += groupStats.postsScanned;
      cycleStats.commentsScanned += groupStats.commentsScanned;
      cycleStats.leadsFound += groupStats.leadsFound;
      cycleStats.llmCalls += groupStats.llmCalls;
      cycleStats.llmCostUsd += groupStats.llmCostUsd;

      if (i < groups.length - 1) {
        const delay = randomInt(30000, 120000);
        console.log(`  Waiting ${Math.round(delay / 1000)}s before next group...`);
        await sleep(delay);
      }
    }
  } finally {
    try {
      await Promise.race([
        closeBrowser(),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
    } catch (err) {
      console.error(`Browser cleanup error: ${err.message}`);
      _context = null;
    }
    releaseLock();
  }

  const elapsed = ((Date.now() - cycleStart) / 1000 / 60).toFixed(1);
  console.log(`\nScrape cycle complete in ${elapsed} minutes`);
  console.log(`  Total: ${cycleStats.postsScanned} posts, ${cycleStats.commentsScanned} comments, ${cycleStats.leadsFound} leads`);

  return cycleStats;
}
