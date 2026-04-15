import { chromium } from "playwright";
import { config } from "./config.js";
import { extractFbUserId } from "./fb-finder/selectors.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SESSION_DIR = path.resolve(PROJECT_ROOT, config.fbFinder.sessionDir);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testPost() {
  // The example post URL you provided
  const postUrl = "https://www.facebook.com/groups/947010960143882/permalink/1257970172381291/";

  console.log("🧪 Testing single post extraction");
  console.log("Post:", postUrl);
  console.log("\nOpening browser...\n");

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: null,
    channel: "chrome",
  }).catch(() => chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: null,
  }));

  const page = await context.newPage();

  try {
    console.log("Navigating to post...");
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(3000);

    console.log("✓ Page loaded\n");

    // Try to expand all comments
    console.log("Expanding comments...");
    const expandButtons = await page.$$('span:has-text("View more comments"), span:has-text("View previous comments"), [aria-label*="View more comments"]');
    console.log(`Found ${expandButtons.length} expand buttons`);

    for (const btn of expandButtons) {
      try {
        await btn.click({ delay: 50 });
        await sleep(1000);
      } catch {}
    }

    await sleep(2000);

    // Find all comment elements
    console.log("\nExtracting comments...");
    const commentElements = await page.$$('div[role="article"]');
    console.log(`Found ${commentElements.length} article elements\n`);

    const leads = [];
    for (let i = 0; i < commentElements.length; i++) {
      const commentEl = commentElements[i];
      try {
        // Get comment text
        const textEl = await commentEl.$('div[dir="auto"] span') || await commentEl.$('div[dir="auto"]');
        const text = textEl ? await textEl.textContent() : "";

        if (!text || text.length < 10) continue;

        // Get commenter link
        const linkEl = await commentEl.$('a[href*="/profile.php"]') ||
                       await commentEl.$('a[href*="facebook.com/"][role="link"]');

        if (!linkEl) continue;

        const profileUrl = await linkEl.getAttribute("href");
        const name = await linkEl.textContent().catch(() => "");
        const fbUserId = extractFbUserId(profileUrl);

        if (!fbUserId) continue;

        leads.push({
          name: name.trim(),
          profileUrl,
          messageUrl: `https://www.facebook.com/messages/t/${fbUserId}`,
          commentPreview: text.slice(0, 100)
        });

        console.log(`${i + 1}. ${name.trim()}`);
        console.log(`   Comment: ${text.slice(0, 80)}...`);
        console.log(`   Profile: ${profileUrl}`);
        console.log(`   Message: https://www.facebook.com/messages/t/${fbUserId}\n`);

      } catch (err) {
        console.error(`Error on comment ${i}:`, err.message);
      }
    }

    console.log(`\n✅ Extracted ${leads.length} potential leads from this post`);

    await sleep(5000);

  } finally {
    await page.close();
    await context.close();
  }
}

testPost().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
