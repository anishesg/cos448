import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { insertFbGroup, getActiveGroups, getActiveKeywords } from "../db.js";
import { SELECTORS, trySelectors } from "../fb-finder/selectors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Discover new Facebook groups by searching for seed terms.
 * Runs daily, navigates to Facebook group search for each term,
 * extracts public groups, and adds them to the DB.
 */
export async function runDiscoverGroups() {
  console.log(`\n[${new Date().toLocaleTimeString()}] Starting group discovery job...`);

  const { seedSearchTerms, maxGroupsActive, sessionDir } = config.fbFinder;
  const activeGroups = getActiveGroups();

  if (activeGroups.length >= maxGroupsActive) {
    console.log(`Already at max active groups (${activeGroups.length}/${maxGroupsActive}), skipping discovery`);
    return;
  }

  // Combine seed terms with LLM-generated discovery keywords
  let llmKeywords = [];
  try {
    llmKeywords = (getActiveKeywords() || []).map((k) => k.keyword);
  } catch {
    // Table may not exist yet
  }
  const allTerms = [...new Set([...seedSearchTerms, ...llmKeywords])];
  // Shuffle so we don't always search the same terms first
  allTerms.sort(() => Math.random() - 0.5);

  const existingUrls = new Set(activeGroups.map((g) => g.group_url));
  const sessionPath = path.resolve(PROJECT_ROOT, sessionDir);

  // Check browser lock
  const lockFile = path.join(PROJECT_ROOT, config.fbFinder.browserLockFile);
  if (fs.existsSync(lockFile)) {
    const stat = fs.statSync(lockFile);
    if (Date.now() - stat.mtimeMs < 30 * 60 * 1000) {
      console.log("Browser lock held, skipping discovery");
      return;
    }
  }

  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  fs.writeFileSync(lockFile, `${process.pid}\n${new Date().toISOString()}`);

  let context;
  try {
    fs.mkdirSync(sessionPath, { recursive: true });
    try {
      context = await chromium.launchPersistentContext(sessionPath, {
        headless: false,
        viewport: null,
        channel: "chrome",
      });
    } catch {
      context = await chromium.launchPersistentContext(sessionPath, {
        headless: false,
        viewport: null,
      });
    }

    let totalDiscovered = 0;

    for (const term of allTerms) {
      if (activeGroups.length + totalDiscovered >= maxGroupsActive) break;

      console.log(`  Searching: "${term}"`);
      const page = await context.newPage();

      try {
        const searchUrl = `https://www.facebook.com/search/groups/?q=${encodeURIComponent(term)}`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await sleep(randomInt(3000, 5000));

        // Scroll multiple times to load more results
        const discoveryScrolls = 6;
        for (let s = 0; s < discoveryScrolls; s++) {
          await page.mouse.wheel(0, randomInt(400, 800));
          await sleep(randomInt(2000, 4000));
        }

        // Extract group links from search results
        const groupLinks = await page.$$eval(
          'a[href*="/groups/"]',
          (links) =>
            links
              .map((a) => ({
                url: a.href,
                text: a.textContent?.trim() || "",
              }))
              .filter((l) => l.url.match(/\/groups\/\d+/) || l.url.match(/\/groups\/[a-zA-Z]/))
        );

        for (const link of groupLinks) {
          // Normalize group URL
          const urlMatch = link.url.match(/(https:\/\/www\.facebook\.com\/groups\/[^/?#]+)/);
          if (!urlMatch) continue;

          const groupUrl = urlMatch[1];
          if (existingUrls.has(groupUrl)) continue;

          // Extract member count if available
          let memberCount = null;
          const memberMatch = link.text.match(/([\d,.]+[KkMm]?)\s*members?/);
          if (memberMatch) {
            let raw = memberMatch[1].replace(/,/g, "");
            if (raw.match(/[Kk]$/)) memberCount = parseFloat(raw) * 1000;
            else if (raw.match(/[Mm]$/)) memberCount = parseFloat(raw) * 1_000_000;
            else memberCount = parseInt(raw, 10);
          }

          const result = insertFbGroup({
            groupUrl,
            groupName: link.text.split("\n")[0]?.trim().slice(0, 200) || null,
            memberCount,
            discoverySource: "search",
            searchKeywords: term,
          });

          if (result.changes > 0) {
            existingUrls.add(groupUrl);
            totalDiscovered++;
            console.log(`    Found: ${link.text.split("\n")[0]?.trim().slice(0, 60)} — ${groupUrl}`);
          }
        }
      } catch (err) {
        console.error(`  Search error for "${term}": ${err.message}`);
      } finally {
        await page.close();
      }

      // Delay between searches
      await sleep(randomInt(5000, 15000));
    }

    console.log(`Discovery complete: ${totalDiscovered} new groups found`);
  } catch (err) {
    console.error("Group discovery error:", err.message);
  } finally {
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
  }
}
