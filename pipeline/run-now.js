#!/usr/bin/env node
/**
 * Fast single-post scrape → message pipeline
 *
 * 1. Go to group
 * 2. Find the Vishnu Veeravali SAT prep post
 * 3. Click into it
 * 4. Grab top 5 commenters
 * 5. Export CSV → launch messenger bot
 */

import "dotenv/config";
import { chromium } from "playwright";
import { spawn } from "child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SESSION_DIR = path.resolve(PROJECT_ROOT, config.fbFinder.sessionDir);
const CSV_PATH = path.join(PROJECT_ROOT, "fb-group-leads.csv");
const MESSENGER_SCRIPT = path.join(PROJECT_ROOT, "scripts", "fb-review-send.js");
const CAMPAIGN_CONFIG_PATH = path.join(PROJECT_ROOT, "campaign.autopilot.config.json");
const MESSAGE_TEMPLATE_PATH = path.join(PROJECT_ROOT, "message-template-autopilot.txt");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const GROUP_URL = "https://www.facebook.com/groups/947010960143882";

async function main() {
  console.log("🚀 FAST PIPELINE: Find post → scrape 5 commenters → message\n");

  fs.mkdirSync(SESSION_DIR, { recursive: true });
  let context;
  try {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: false, viewport: null, channel: "chrome",
    });
  } catch {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: false, viewport: null,
    });
  }

  const page = await context.newPage();
  const leads = [];

  try {
    // ── Step 1: Go to group ──
    console.log("1️⃣  Going to group...");
    await page.goto(GROUP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(2000);
    console.log("   ✓ Group loaded\n");

    // ── Step 2: Go directly to the known post ──
    console.log("2️⃣  Navigating to target post...");
    const postPermalink = "https://www.facebook.com/groups/947010960143882/permalink/1257970172381291";
    console.log("   Target: " + postPermalink + "\n");

    // ── Step 3: Click into post ──
    console.log("3️⃣  Opening post...");
    await page.goto(postPermalink, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(1500);
    console.log("   ✓ Post loaded\n");

    // ── Step 4: Expand comments and grab top 5 ──
    console.log("4️⃣  Scraping commenters...");

    // Quick expand
    for (let i = 0; i < 5; i++) {
      const clicked = await page.evaluate(() => {
        const els = document.querySelectorAll('span, div[role="button"]');
        for (const el of els) {
          const t = (el.textContent || "").trim().toLowerCase();
          if (t.includes("view more comment") || t.includes("view previous comment")) {
            el.click();
            return true;
          }
        }
        return false;
      });
      if (!clicked) break;
      await sleep(500);
    }

    await sleep(500);

    // Extract commenters
    const commenters = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const articles = document.querySelectorAll('div[role="article"]');

      for (const article of articles) {
        const links = article.querySelectorAll('a[role="link"]');
        for (const link of links) {
          const href = link.getAttribute("href") || "";
          const text = (link.textContent || "").trim();

          if (!text || text.length < 2 || text.length > 80) continue;
          if (href.includes("/groups/")) continue;
          if (href.includes("comment_id")) continue;
          if (href.includes("/hashtag/")) continue;
          if (href.includes("/posts/")) continue;
          if (href.includes("/permalink/")) continue;
          if (href.startsWith("#")) continue;
          if (text.match(/^\d+[hmdyw]\s*$/)) continue;
          if (text.match(/^\d+$/)) continue;
          if (text.toLowerCase().includes("reply") || text.toLowerCase().includes("like")) continue;
          if (!/^[A-ZÀ-Ö]/.test(text)) continue;

          let userId = null;
          const idMatch = href.match(/[?&]id=(\d+)/);
          if (idMatch) {
            userId = idMatch[1];
          } else {
            const vanityMatch = href.match(/facebook\.com\/([a-zA-Z0-9.]{3,50})(?:[/?#]|$)/);
            if (vanityMatch) {
              const slug = vanityMatch[1];
              if (!["groups", "posts", "permalink", "photo", "watch", "events", "marketplace", "gaming", "stories", "share", "sharer"].includes(slug)) {
                userId = slug;
              }
            }
          }

          if (!userId || seen.has(userId)) continue;
          seen.add(userId);
          results.push({ name: text, userId, profileUrl: href.startsWith("http") ? href : "https://www.facebook.com" + href });

          if (results.length >= 5) return results;
        }
      }
      return results;
    });

    console.log(`   Found ${commenters.length} commenters:\n`);
    for (const c of commenters) {
      console.log(`   • ${c.name} (${c.userId})`);
      leads.push({
        name: c.name,
        firstName: c.name.split(/\s+/)[0],
        userId: c.userId,
        profileUrl: c.profileUrl,
        messageUrl: `https://www.facebook.com/messages/t/${c.userId}`,
      });
    }

  } finally {
    await page.close();
    await context.close();
  }

  if (leads.length === 0) {
    console.log("\n⚠️  No leads found.");
    return;
  }

  // ── Step 5: Export CSV ──
  console.log(`\n5️⃣  Exporting ${leads.length} leads...`);
  const header = "firstName,messageId,Name,Profile URL,Message URL,Completed";
  const rows = leads.map(l => `${l.firstName},${l.userId},${l.name},${l.profileUrl},${l.messageUrl},`);
  fs.writeFileSync(CSV_PATH, [header, ...rows].join("\n") + "\n", "utf8");
  console.log("   ✓ " + CSV_PATH);

  // ── Step 6: Message ──
  console.log(`\n6️⃣  Launching messenger bot...\n`);

  if (!fs.existsSync(MESSAGE_TEMPLATE_PATH)) {
    fs.writeFileSync(MESSAGE_TEMPLATE_PATH, `Hi {{firstName}},

I came across your post in the Facebook group and wanted to reach out! I'm Anish, a college admissions consultant who helps families navigate the college application process.

I offer personalized 1-on-1 guidance for high school students, including:
• College list building & strategy
• Essay brainstorming & editing
• Extracurricular planning
• Application review

Let me know if you'd like to schedule a free 15-minute intro call: https://tinyurl.com/anishconsulting

Best,
Anish`);
  }

  fs.writeFileSync(CAMPAIGN_CONFIG_PATH, JSON.stringify({
    leadsCsvPath: CSV_PATH,
    messageTemplatePath: MESSAGE_TEMPLATE_PATH,
    imagePath: "",
    userDataDir: "./.session/facebook",
    threadUrlTemplate: "https://www.facebook.com/messages/t/{messageId}",
    browserChannel: "chrome",
    headless: false,
    sendMode: "terminalConfirm",
    betweenMessagesMinMs: 30000,
    betweenMessagesMaxMs: 60000,
    startAtRow: 1,
  }, null, 2));

  await new Promise((resolve) => {
    const child = spawn("node", [MESSENGER_SCRIPT, "--config", CAMPAIGN_CONFIG_PATH], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });

  console.log("\n✅ Done.");
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});
