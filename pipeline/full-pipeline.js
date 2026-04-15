#!/usr/bin/env node
/**
 * FULL END-TO-END FB OUTREACH PIPELINE
 *
 * 1. Open browser → navigate to each group
 * 2. Scroll feed → find ALL post permalinks
 * 3. Click into each post → scrape ALL commenters
 * 4. Export leads → immediately launch messenger bot
 */

import "dotenv/config";
import { chromium } from "playwright";
import { spawn } from "child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SESSION_DIR = path.resolve(PROJECT_ROOT, config.fbFinder.sessionDir);
const CSV_PATH = path.join(PROJECT_ROOT, "fb-group-leads.csv");
const MESSENGER_SCRIPT = path.join(PROJECT_ROOT, "scripts", "fb-review-send.js");
const CAMPAIGN_CONFIG_PATH = path.join(PROJECT_ROOT, "campaign.autopilot.config.json");
const MESSAGE_TEMPLATE_PATH = path.join(PROJECT_ROOT, "message-template-autopilot.txt");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function hashText(t) { return crypto.createHash("sha256").update((t || "").slice(0, 500)).digest("hex"); }

const TARGET_GROUPS = [
  { url: "https://www.facebook.com/groups/1420935962654653", name: "College Admissions Parents" },
  { url: "https://www.facebook.com/groups/947010960143882", name: "High School College Prep" },
];

async function launchBrowser() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  try {
    return await chromium.launchPersistentContext(SESSION_DIR, {
      headless: false, viewport: null, channel: "chrome",
    });
  } catch {
    return await chromium.launchPersistentContext(SESSION_DIR, {
      headless: false, viewport: null,
    });
  }
}

// ─── Phase 1: Scrape ────────────────────────────────────────────

async function scrapeGroup(page, group, knownUsers, db) {
  const leads = [];

  console.log(`\n📍 ${group.name}`);
  console.log(`   ${group.url}`);

  await page.goto(group.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2000);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (bodyText.includes("This content isn't available")) {
    console.log(`   ⚠️  Not accessible, skipping`);
    return leads;
  }

  // ── Collect post permalinks by scrolling ──
  console.log(`   Scrolling to find posts...`);
  const postLinks = new Set();

  for (let scroll = 0; scroll < 15; scroll++) {
    // Grab ALL permalink-style links currently visible on the page
    const links = await page.evaluate(() => {
      const anchors = document.querySelectorAll('a[href]');
      const found = [];
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        // Match /permalink/ or /posts/ links
        if (href.includes("/permalink/") || (href.includes("/posts/") && href.includes("/groups/"))) {
          let clean = href.split("?")[0];
          if (!clean.startsWith("http")) clean = "https://www.facebook.com" + clean;
          found.push(clean);
        }
      }
      return [...new Set(found)];
    });

    for (const link of links) postLinks.add(link);

    // Fast scroll
    await page.mouse.wheel(0, 800);
    await sleep(800);
  }

  console.log(`   Found ${postLinks.size} post links`);

  // ── Click into each post and scrape commenters ──
  const dbGroup = db.prepare("SELECT id FROM fb_groups WHERE group_url = ?").get(group.url);
  const groupId = dbGroup ? dbGroup.id : null;

  let postNum = 0;
  for (const postUrl of postLinks) {
    postNum++;
    try {
      await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await sleep(1500);

      // Expand all comments fast
      for (let i = 0; i < 15; i++) {
        const expanded = await page.evaluate(() => {
          const btns = document.querySelectorAll('span, div[role="button"]');
          for (const btn of btns) {
            const t = (btn.textContent || "").trim().toLowerCase();
            if (t.includes("view more comment") || t.includes("view previous comment") ||
                t.includes("view all") || t === "see more") {
              btn.click();
              return true;
            }
          }
          return false;
        });
        if (!expanded) break;
        await sleep(800);
      }

      // Extract ALL commenters from the page
      const commenters = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        const articles = document.querySelectorAll('div[role="article"]');

        for (const article of articles) {
          // Find all links in this article
          const links = article.querySelectorAll('a[role="link"]');
          for (const link of links) {
            const href = link.getAttribute("href") || "";
            const text = (link.textContent || "").trim();

            // Skip non-profile links
            if (!text || text.length < 2 || text.length > 80) continue;
            if (href.includes("/groups/")) continue;
            if (href.includes("comment_id")) continue;
            if (href.includes("/hashtag/")) continue;
            if (href.includes("/posts/")) continue;
            if (href.includes("/permalink/")) continue;
            if (href.startsWith("#")) continue;
            if (text.match(/^\d+[hmdyw]\s*$/)) continue; // timestamps like "2h", "3d"
            if (text.match(/^\d+$/)) continue;
            if (text.toLowerCase().includes("reply") || text.toLowerCase().includes("like")) continue;

            // Must look like a name (starts with uppercase letter)
            if (!/^[A-ZÀ-Ö]/.test(text)) continue;

            // Extract user ID from href
            let userId = null;
            const idMatch = href.match(/[?&]id=(\d+)/);
            if (idMatch) {
              userId = idMatch[1];
            } else {
              const vanityMatch = href.match(/facebook\.com\/([a-zA-Z0-9.]{3,50})(?:[/?#]|$)/);
              if (vanityMatch) {
                const slug = vanityMatch[1];
                // Filter out non-profile slugs
                if (!["groups", "posts", "permalink", "photo", "watch", "events", "marketplace", "gaming", "stories"].includes(slug)) {
                  userId = slug;
                }
              }
            }

            if (!userId || seen.has(userId)) continue;
            seen.add(userId);

            results.push({
              name: text,
              profileUrl: href.startsWith("http") ? href : "https://www.facebook.com" + href,
              userId,
            });
          }
        }

        return results;
      });

      // Filter to new leads only and insert
      let newFromPost = 0;
      for (const c of commenters) {
        if (knownUsers.has(c.userId)) continue;
        knownUsers.add(c.userId);

        const messageUrl = `https://www.facebook.com/messages/t/${c.userId}`;

        try {
          db.prepare(`
            INSERT OR IGNORE INTO fb_leads (fb_user_id, name, profile_url, message_url, source_group_id, source_comment_text, classification_reason, classification_confidence, outreach_state)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED')
          `).run(c.userId, c.name, c.profileUrl, messageUrl, groupId, "", "Active in college admissions group", 1.0);
        } catch {}

        leads.push({
          name: c.name,
          firstName: c.name.split(/\s+/)[0],
          profileUrl: c.profileUrl,
          messageUrl,
          userId: c.userId,
        });
        newFromPost++;
      }

      if (newFromPost > 0) {
        console.log(`   [${postNum}/${postLinks.size}] +${newFromPost} leads (${leads.length} total)`);
      }
    } catch (err) {
      // silently skip failed posts
    }
  }

  console.log(`   ✅ ${group.name}: ${leads.length} leads`);
  return leads;
}

// ─── Phase 2: Export ────────────────────────────────────────────

function exportLeadsToCsv(leads) {
  if (leads.length === 0) return null;

  const header = "firstName,messageId,Name,Profile URL,Message URL,Completed";
  const rows = leads.map(l => {
    const fn = l.firstName.replace(/,/g, "");
    const name = l.name.replace(/,/g, "");
    return `${fn},${l.userId},${name},${l.profileUrl},${l.messageUrl},`;
  });

  fs.writeFileSync(CSV_PATH, [header, ...rows].join("\n") + "\n", "utf8");
  console.log(`\n📄 Exported ${leads.length} leads to ${CSV_PATH}`);
  return CSV_PATH;
}

// ─── Phase 3: Message ───────────────────────────────────────────

function ensureMessageTemplate() {
  if (fs.existsSync(MESSAGE_TEMPLATE_PATH)) return;
  fs.writeFileSync(MESSAGE_TEMPLATE_PATH, `Hi {{firstName}},

I came across your post in the Facebook group and wanted to reach out! I'm Anish, a college admissions consultant who helps families navigate the college application process.

I offer personalized 1-on-1 guidance for high school students, including:
• College list building & strategy
• Essay brainstorming & editing
• Extracurricular planning
• Application review

I meet with students 2x per month with unlimited email support. If you're interested in learning more, I'd love to chat!

Let me know if you'd like to schedule a free 15-minute intro call: https://tinyurl.com/anishconsulting

Best,
Anish`);
}

async function launchMessengerBot(csvPath) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📨 PHASE 3: MESSAGING`);
  console.log(`${"═".repeat(60)}\n`);

  ensureMessageTemplate();

  const campaignConfig = {
    leadsCsvPath: csvPath,
    messageTemplatePath: MESSAGE_TEMPLATE_PATH,
    imagePath: "",
    userDataDir: "./.session/facebook",
    threadUrlTemplate: "https://www.facebook.com/messages/t/{messageId}",
    browserChannel: "chrome",
    headless: false,
    sendMode: "terminalConfirm",
    betweenMessagesMinMs: 30000,
    betweenMessagesMaxMs: 120000,
    startAtRow: 1,
  };
  fs.writeFileSync(CAMPAIGN_CONFIG_PATH, JSON.stringify(campaignConfig, null, 2));

  console.log(`   Leads: ${csvPath}`);
  console.log(`   Mode: terminalConfirm (you approve each send)\n`);

  return new Promise((resolve) => {
    const child = spawn("node", [MESSENGER_SCRIPT, "--config", CAMPAIGN_CONFIG_PATH], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 FRIDCAY OUTREACH PIPELINE\n`);

  const db = getDb();
  for (const g of TARGET_GROUPS) {
    try {
      db.prepare(`INSERT OR IGNORE INTO fb_groups (group_url, group_name, discovery_source, status) VALUES (?, ?, 'AI_DISCOVERED', 'ACTIVE')`).run(g.url, g.name);
    } catch {}
  }

  // ── SCRAPE ──
  console.log(`── PHASE 1: SCRAPING ──`);

  const context = await launchBrowser();
  const page = await context.newPage();
  const allLeads = [];
  const knownUsers = new Set();

  try {
    const existing = db.prepare("SELECT fb_user_id FROM fb_leads").all();
    existing.forEach(r => knownUsers.add(r.fb_user_id));
    if (knownUsers.size > 0) console.log(`   Skipping ${knownUsers.size} already-known users`);
  } catch {}

  try {
    for (const group of TARGET_GROUPS) {
      const groupLeads = await scrapeGroup(page, group, knownUsers, db);
      allLeads.push(...groupLeads);
    }
  } finally {
    await page.close();
    await context.close();
  }

  // ── EXPORT ──
  console.log(`\n── PHASE 2: EXPORT ──`);
  console.log(`   Total leads: ${allLeads.length}`);

  const csvPath = exportLeadsToCsv(allLeads);

  // ── MESSAGE ──
  if (csvPath) {
    await launchMessengerBot(csvPath);
  } else {
    console.log(`\n⚠️  No leads found to message.`);
  }

  console.log(`\n✅ DONE. ${allLeads.length} leads processed.`);
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});
