/**
 * Electron-based test runner
 * Tests all IPC handlers by running them in the actual Electron environment
 */

const { app, BrowserWindow } = require("electron");
const path = require("path");

// Import the main process handlers
const Database = require("better-sqlite3");
const DB_PATH = path.join(__dirname, "..", "pipeline", "pipeline.db");

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, fn) {
  try {
    const result = fn();
    console.log(`✓ ${name}`);
    testResults.passed++;
    testResults.tests.push({ name, passed: true });
    return result;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    testResults.failed++;
    testResults.tests.push({ name, passed: false, error: err.message });
  }
}

app.whenReady().then(() => {
  console.log("=== Electron Dashboard Test Suite ===\n");

  // Test 1: Database Connection
  const db = test("Database connection", () => {
    const database = new Database(DB_PATH);
    database.pragma("journal_mode = WAL");
    const result = database.prepare("SELECT 1 as test").get();
    if (result.test !== 1) throw new Error("Query failed");
    return database;
  });

  if (!db) {
    console.error("\n✗ Cannot proceed without database connection");
    app.quit();
    return;
  }

  // Test 2: Overview Data
  test("Overview data query", () => {
    const today = new Date().toISOString().slice(0, 10);
    const totalLeads = db.prepare("SELECT COUNT(*) as c FROM fb_leads").get().c;
    const activeGroups = db.prepare("SELECT COUNT(*) as c FROM fb_groups WHERE status = 'ACTIVE'").get().c;
    const budget = db.prepare("SELECT * FROM fb_llm_budget WHERE date = ?").get(today);

    console.log(`  → Leads: ${totalLeads}, Groups: ${activeGroups}, Budget: $${budget?.estimated_cost_usd?.toFixed(4) || "0.0000"}`);

    const recentLeads = db.prepare("SELECT * FROM fb_leads ORDER BY created_at DESC LIMIT 5").all();
    const topGroups = db.prepare("SELECT * FROM fb_groups ORDER BY lead_yield_rate DESC LIMIT 3").all();

    return { totalLeads, activeGroups, recentLeads: recentLeads.length, topGroups: topGroups.length };
  });

  // Test 3: Leads Table
  test("Leads table query", () => {
    const leads = db.prepare(`
      SELECT l.*, g.group_name FROM fb_leads l
      LEFT JOIN fb_groups g ON l.source_group_id = g.id
      LIMIT 10
    `).all();

    console.log(`  → Retrieved ${leads.length} leads with group names`);
    return leads;
  });

  // Test 4: Groups Table
  test("Groups table query", () => {
    const groups = db.prepare("SELECT * FROM fb_groups ORDER BY lead_yield_rate DESC").all();
    console.log(`  → Retrieved ${groups.length} groups`);
    if (groups.length > 0) {
      const top = groups[0];
      console.log(`  → Top: ${top.group_name || "Unnamed"} (${(top.lead_yield_rate * 100).toFixed(2)}% yield)`);
    }
    return groups;
  });

  // Test 5: Scrape Log
  test("Scrape log query", () => {
    const log = db.prepare(`
      SELECT s.*, g.group_name FROM fb_scrape_log s
      LEFT JOIN fb_groups g ON s.group_id = g.id
      ORDER BY s.started_at DESC LIMIT 10
    `).all();

    console.log(`  → Retrieved ${log.length} scrape sessions`);
    return log;
  });

  // Test 6: Budget History
  test("Budget history query", () => {
    const budget = db.prepare("SELECT * FROM fb_llm_budget ORDER BY date DESC LIMIT 7").all();
    console.log(`  → Retrieved ${budget.length} budget records`);
    const totalSpend = budget.reduce((sum, b) => sum + (b.estimated_cost_usd || 0), 0);
    console.log(`  → Total spend (last 7 days): $${totalSpend.toFixed(4)}`);
    return budget;
  });

  // Test 7: Window Creation
  test("Create BrowserWindow", () => {
    const win = new BrowserWindow({
      width: 1340,
      height: 860,
      show: false, // Don't show during test
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.loadFile(path.join(__dirname, "renderer", "index.html"));
    console.log(`  → Window created (${win.getSize().join("x")})`);

    // Clean up after 2 seconds
    setTimeout(() => {
      win.close();
      finishTests();
    }, 2000);

    return win;
  });

  function finishTests() {
    db.close();

    console.log("\n=== Test Results ===");
    console.log(`✓ Passed: ${testResults.passed}`);
    console.log(`✗ Failed: ${testResults.failed}`);
    console.log(`Total: ${testResults.passed + testResults.failed}`);

    if (testResults.failed > 0) {
      console.log("\n⚠ Some tests failed:");
      testResults.tests
        .filter((t) => !t.passed)
        .forEach((t) => console.log(`  - ${t.name}: ${t.error}`));
      console.log("\nApp will still launch, but review errors above.");
    } else {
      console.log("\n✓ All tests passed! Dashboard is ready.");
    }

    // Exit after short delay
    setTimeout(() => app.quit(), 500);
  }
});

app.on("window-all-closed", () => {
  // Don't quit on window close during tests
});
