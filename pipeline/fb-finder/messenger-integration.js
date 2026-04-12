import { spawn } from "child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const CAMPAIGN_CONFIG_PATH = path.join(PROJECT_ROOT, "campaign.autopilot.config.json");
const MESSAGE_TEMPLATE_PATH = path.join(PROJECT_ROOT, "message-template-autopilot.txt");
const MESSENGER_SCRIPT = path.join(PROJECT_ROOT, "scripts", "fb-review-send.js");

/**
 * Create campaign config for autopilot leads
 */
function createCampaignConfig(csvPath) {
  const config = {
    leadsCsvPath: csvPath,
    messageTemplatePath: MESSAGE_TEMPLATE_PATH,
    imagePath: "",
    userDataDir: "./.session/facebook",
    threadUrlTemplate: "https://www.facebook.com/messages/t/{messageId}",
    browserChannel: "chrome",
    headless: false,
    sendMode: "auto", // Auto-send messages
    postActionDelayMs: 45000, // 45s between messages
    startAtRow: 1,
  };

  fs.writeFileSync(CAMPAIGN_CONFIG_PATH, JSON.stringify(config, null, 2));
  return config;
}

/**
 * Create message template if it doesn't exist
 */
function ensureMessageTemplate() {
  if (fs.existsSync(MESSAGE_TEMPLATE_PATH)) return;

  const defaultTemplate = `Hi {{firstName}},

I came across your post in the Facebook group and wanted to reach out! I'm Anish, a college admissions consultant who helps families navigate the college application process.

I offer personalized 1-on-1 guidance for high school students, including:
• College list building & strategy
• Essay brainstorming & editing
• Extracurricular planning
• Application review

I meet with students 2x per month with unlimited email support. If you're interested in learning more, I'd love to chat!

Let me know if you'd like to schedule a free 15-minute intro call: https://tinyurl.com/anishconsulting

Best,
Anish`;

  fs.writeFileSync(MESSAGE_TEMPLATE_PATH, defaultTemplate);
  console.log("  Created default message template:", MESSAGE_TEMPLATE_PATH);
}

/**
 * Run the messenger bot to send messages to leads
 * @param {string} csvPath - Path to leads CSV
 * @returns {Promise<{sent: number, failed: number, skipped: number}>}
 */
export async function runMessengerBot(csvPath) {
  console.log("\n📨 Running messenger bot...");

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Leads CSV not found: ${csvPath}`);
  }

  if (!fs.existsSync(MESSENGER_SCRIPT)) {
    throw new Error(`Messenger script not found: ${MESSENGER_SCRIPT}`);
  }

  // Ensure template exists
  ensureMessageTemplate();

  // Create campaign config
  createCampaignConfig(csvPath);

  console.log(`  Config: ${CAMPAIGN_CONFIG_PATH}`);
  console.log(`  CSV: ${csvPath}`);

  return new Promise((resolve, reject) => {
    const child = spawn("node", [MESSENGER_SCRIPT, CAMPAIGN_CONFIG_PATH], {
      cwd: PROJECT_ROOT,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let output = "";
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    child.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);

      // Parse output to count results
      if (text.includes("✓ Message sent")) sent++;
      if (text.includes("✗") || text.includes("Failed")) failed++;
      if (text.includes("Skipping") || text.includes("already completed")) skipped++;
    });

    child.stderr.on("data", (data) => {
      output += data.toString();
      process.stderr.write(data.toString());
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`  ✓ Messenger bot finished (sent: ${sent}, failed: ${failed}, skipped: ${skipped})`);
        resolve({ sent, failed, skipped });
      } else {
        reject(new Error(`Messenger bot exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn messenger bot: ${err.message}`));
    });
  });
}

/**
 * Update lead statuses in DB after messaging
 * Marks leads as MESSAGED if they appear in the CSV with Completed=TRUE
 */
export function updateLeadStatuses(csvPath) {
  if (!fs.existsSync(csvPath)) return 0;

  const db = getDb();
  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split("\n");

  let updated = 0;
  for (let i = 1; i < lines.length; i++) {
    // Skip header
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    const profileUrl = cols[1];
    const completed = cols[3]?.toLowerCase() === "true";

    if (!completed) continue;

    // Find lead by profile URL and mark as messaged
    const result = db.prepare(`
      UPDATE fb_leads
      SET outreach_state = 'MESSAGED',
          messaged_at = datetime('now'),
          updated_at = datetime('now')
      WHERE profile_url = ?
        AND outreach_state != 'MESSAGED'
    `).run(profileUrl);

    updated += result.changes;
  }

  if (updated > 0) {
    console.log(`  ✓ Updated ${updated} leads to MESSAGED status`);
  }

  return updated;
}

function parseCsvLine(line) {
  const cols = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

/**
 * Count how many leads still need to be messaged
 */
export function getUnmessagedLeadCount() {
  const db = getDb();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM fb_leads
    WHERE outreach_state = 'EXPORTED_CSV'
  `).get();
  return result.count;
}
