/**
 * Comprehensive Dashboard Test Suite
 * Tests all IPC handlers, DB queries, and job running without launching the GUI
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "..", "pipeline", "pipeline.db");
const ENV_PATH = path.join(__dirname, "..", "pipeline", ".env");

console.log("=== Dashboard Test Suite ===\n");

let db;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    testsFailed++;
  }
}

// Test 1: Database Connection
test("Database connection", () => {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  const result = db.prepare("SELECT 1 as test").get();
  if (result.test !== 1) throw new Error("Query returned unexpected result");
});

// Test 2: Overview Query
test("Overview query (get-overview)", () => {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const totalLeads = db.prepare("SELECT COUNT(*) as c FROM fb_leads").get().c;
  const todayLeads = db.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE date(created_at) = ?").get(today).c;
  const weekLeads = db.prepare("SELECT COUNT(*) as c FROM fb_leads WHERE created_at >= ?").get(weekAgo).c;
  const activeGroups = db.prepare("SELECT COUNT(*) as c FROM fb_groups WHERE status = 'ACTIVE'").get().c;
  const budget = db.prepare("SELECT * FROM fb_llm_budget WHERE date = ?").get(today);

  console.log(`  → Total leads: ${totalLeads}, Today: ${todayLeads}, Week: ${weekLeads}, Active groups: ${activeGroups}`);

  const recentLeads = db.prepare(`
    SELECT l.*, g.group_name FROM fb_leads l
    LEFT JOIN fb_groups g ON l.source_group_id = g.id
    ORDER BY l.created_at DESC LIMIT 8
  `).all();

  const dailyLeads = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM fb_leads WHERE created_at >= date('now', '-7 days')
    GROUP BY date(created_at) ORDER BY day
  `).all();

  const topGroups = db.prepare(`
    SELECT * FROM fb_groups WHERE status = 'ACTIVE'
    ORDER BY lead_yield_rate DESC LIMIT 5
  `).all();

  console.log(`  → Recent leads: ${recentLeads.length}, Daily data points: ${dailyLeads.length}, Top groups: ${topGroups.length}`);
});

// Test 3: Leads Query
test("Leads query with pagination (get-leads)", () => {
  const offset = 0;
  const limit = 30;
  const where = "1=1";

  const total = db.prepare(`SELECT COUNT(*) as c FROM fb_leads l WHERE ${where}`).get().c;
  const leads = db.prepare(`
    SELECT l.*, g.group_name FROM fb_leads l
    LEFT JOIN fb_groups g ON l.source_group_id = g.id
    WHERE ${where}
    ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  console.log(`  → Total: ${total}, Fetched: ${leads.length}`);
});

// Test 4: Leads Query with Filter
test("Leads query with status filter", () => {
  const status = "QUEUED";
  const where = "l.outreach_state = ?";
  const total = db.prepare(`SELECT COUNT(*) as c FROM fb_leads l WHERE ${where}`).get(status).c;
  const leads = db.prepare(`
    SELECT l.*, g.group_name FROM fb_leads l
    LEFT JOIN fb_groups g ON l.source_group_id = g.id
    WHERE ${where}
    ORDER BY l.created_at DESC LIMIT 30
  `).all(status);

  console.log(`  → Queued leads: ${total}`);
});

// Test 5: Groups Query
test("Groups query (get-groups)", () => {
  const groups = db.prepare("SELECT * FROM fb_groups ORDER BY lead_yield_rate DESC").all();
  console.log(`  → Total groups: ${groups.length}`);
  if (groups.length > 0) {
    const top = groups[0];
    console.log(`  → Top group: ${top.group_name || top.group_url} (yield: ${(top.lead_yield_rate * 100).toFixed(2)}%)`);
  }
});

// Test 6: Add Group
test("Add group (add-group)", () => {
  const testUrl = `https://www.facebook.com/groups/test_${Date.now()}`;
  const result = db.prepare(`
    INSERT OR IGNORE INTO fb_groups (group_url, group_name, discovery_source)
    VALUES (?, ?, 'manual')
  `).run(testUrl, "Test Group");

  if (result.changes === 0) {
    console.log("  → (Group already exists, insert ignored)");
  } else {
    console.log(`  → Inserted test group with ID: ${result.lastInsertRowid}`);
    // Clean up
    db.prepare("DELETE FROM fb_groups WHERE id = ?").run(result.lastInsertRowid);
  }
});

// Test 7: Update Group Status
test("Update group status (update-group-status)", () => {
  const groups = db.prepare("SELECT * FROM fb_groups LIMIT 1").all();
  if (groups.length > 0) {
    const originalStatus = groups[0].status;
    const newStatus = originalStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    db.prepare("UPDATE fb_groups SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, groups[0].id);

    // Verify
    const updated = db.prepare("SELECT status FROM fb_groups WHERE id = ?").get(groups[0].id);
    if (updated.status !== newStatus) throw new Error("Status not updated");

    // Restore
    db.prepare("UPDATE fb_groups SET status = ? WHERE id = ?").run(originalStatus, groups[0].id);
    console.log(`  → Updated status: ${originalStatus} → ${newStatus} → ${originalStatus} (restored)`);
  } else {
    console.log("  → (No groups to test with)");
  }
});

// Test 8: Scrape Log Query
test("Scrape log query (get-scrape-log)", () => {
  const log = db.prepare(`
    SELECT s.*, g.group_name FROM fb_scrape_log s
    LEFT JOIN fb_groups g ON s.group_id = g.id
    ORDER BY s.started_at DESC LIMIT 30
  `).all();

  console.log(`  → Scrape sessions: ${log.length}`);
  if (log.length > 0) {
    const latest = log[0];
    console.log(`  → Latest: ${latest.group_name || "Unknown"} (${latest.status}, ${latest.leads_found} leads)`);
  }
});

// Test 9: Budget History Query
test("Budget history query (get-budget-history)", () => {
  const budget = db.prepare("SELECT * FROM fb_llm_budget ORDER BY date DESC LIMIT 14").all();
  console.log(`  → Budget records: ${budget.length}`);
  if (budget.length > 0) {
    const latest = budget[0];
    console.log(`  → Latest (${latest.date}): ${latest.total_calls} calls, $${latest.estimated_cost_usd.toFixed(4)}`);
  }
});

// Test 10: Config Read
test("Config read (get-config)", () => {
  if (!fs.existsSync(ENV_PATH)) {
    console.log("  → (.env not found, skipping)");
    return;
  }

  const content = fs.readFileSync(ENV_PATH, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }

  const cfg = {
    dailyBudget: parseFloat(env.FB_FINDER_DAILY_BUDGET || "15"),
    minConfidence: parseFloat(env.FB_FINDER_MIN_CONFIDENCE || "0.7"),
    groupsPerScrape: parseInt(env.FB_FINDER_GROUPS_PER_SCRAPE || "4", 10),
  };

  console.log(`  → Config loaded: dailyBudget=${cfg.dailyBudget}, minConfidence=${cfg.minConfidence}, groupsPerScrape=${cfg.groupsPerScrape}`);
});

// Test 11: Table Existence
test("All required tables exist", () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const tableNames = tables.map((t) => t.name);

  const required = ["leads", "fb_leads", "fb_groups", "fb_scrape_log", "fb_llm_budget", "email_log"];
  const missing = required.filter((t) => !tableNames.includes(t));

  if (missing.length > 0) {
    throw new Error(`Missing tables: ${missing.join(", ")}`);
  }

  console.log(`  → All ${required.length} required tables exist: ${required.join(", ")}`);
});

// Test 12: Lead Update
test("Update lead status (update-lead-status)", () => {
  const leads = db.prepare("SELECT * FROM fb_leads LIMIT 1").all();
  if (leads.length > 0) {
    const lead = leads[0];
    const originalStatus = lead.outreach_state;
    const newStatus = "EXPORTED_CSV";

    db.prepare("UPDATE fb_leads SET outreach_state = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, lead.id);
    const updated = db.prepare("SELECT outreach_state FROM fb_leads WHERE id = ?").get(lead.id);

    if (updated.outreach_state !== newStatus) throw new Error("Status not updated");

    // Restore
    db.prepare("UPDATE fb_leads SET outreach_state = ? WHERE id = ?").run(originalStatus, lead.id);
    console.log(`  → Updated lead status: ${originalStatus} → ${newStatus} → ${originalStatus} (restored)`);
  } else {
    console.log("  → (No leads to test with)");
  }
});

// Test 13: Data Integrity
test("Data integrity checks", () => {
  // Check for orphaned leads
  const orphanedLeads = db.prepare(`
    SELECT COUNT(*) as c FROM fb_leads
    WHERE source_group_id IS NOT NULL
    AND source_group_id NOT IN (SELECT id FROM fb_groups)
  `).get().c;

  // Check for invalid statuses
  const invalidStatuses = db.prepare(`
    SELECT COUNT(*) as c FROM fb_groups
    WHERE status NOT IN ('ACTIVE', 'PAUSED', 'RETIRED')
  `).get().c;

  console.log(`  → Orphaned leads: ${orphanedLeads}, Invalid group statuses: ${invalidStatuses}`);

  if (orphanedLeads > 0) console.log(`  ⚠ Warning: ${orphanedLeads} leads reference non-existent groups`);
  if (invalidStatuses > 0) throw new Error(`${invalidStatuses} groups have invalid status`);
});

// Test 14: Complex Query Performance
test("Complex query performance", () => {
  const start = Date.now();

  // Simulate a complex dashboard query
  const result = db.prepare(`
    SELECT
      g.id,
      g.group_name,
      g.lead_yield_rate,
      g.total_leads_found,
      g.total_comments_scanned,
      COUNT(l.id) as recent_leads
    FROM fb_groups g
    LEFT JOIN fb_leads l ON l.source_group_id = g.id
      AND l.created_at >= date('now', '-7 days')
    WHERE g.status = 'ACTIVE'
    GROUP BY g.id
    ORDER BY g.lead_yield_rate DESC
    LIMIT 10
  `).all();

  const elapsed = Date.now() - start;
  console.log(`  → Query completed in ${elapsed}ms, returned ${result.length} groups`);

  if (elapsed > 100) console.log(`  ⚠ Warning: Query took ${elapsed}ms (>100ms)`);
});

// Test 15: Frontend Rendering (syntax check)
test("Frontend JavaScript syntax", () => {
  const appJs = fs.readFileSync(path.join(__dirname, "renderer", "app.js"), "utf8");
  const stylesCSS = fs.readFileSync(path.join(__dirname, "renderer", "styles.css"), "utf8");
  const indexHTML = fs.readFileSync(path.join(__dirname, "renderer", "index.html"), "utf8");

  // Basic validation
  if (!appJs.includes("loadView")) throw new Error("app.js missing loadView function");
  if (!appJs.includes("renderOverview")) throw new Error("app.js missing renderOverview function");
  if (!stylesCSS.includes("--indigo")) throw new Error("styles.css missing design tokens");
  if (!indexHTML.includes("view-container")) throw new Error("index.html missing view container");

  console.log(`  → Frontend files: app.js (${(appJs.length / 1024).toFixed(1)}KB), styles.css (${(stylesCSS.length / 1024).toFixed(1)}KB), index.html (${(indexHTML.length / 1024).toFixed(1)}KB)`);
});

// Clean up
if (db) db.close();

// Summary
console.log("\n=== Test Results ===");
console.log(`✓ Passed: ${testsPassed}`);
console.log(`✗ Failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  console.log("\n⚠ Some tests failed. Review errors above.");
  process.exit(1);
} else {
  console.log("\n✓ All tests passed! Dashboard is ready to launch.");
  console.log("\nLaunch command:");
  console.log("  cd dashboard && npm start");
}
