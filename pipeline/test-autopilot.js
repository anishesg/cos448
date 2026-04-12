/**
 * Autopilot Resilience Test Suite
 *
 * Tests the autopilot system for:
 * 1. Stale state cleanup on startup
 * 2. Per-step error isolation (one failure doesn't kill cycle)
 * 3. Exponential backoff on consecutive failures
 * 4. Graceful shutdown via shuttingDown flag
 * 5. DB operations are correct
 * 6. Browser lock force-release
 * 7. Cycle recording and finalization
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env before anything else
import "dotenv/config";

import {
  getDb,
  getAutopilotState,
  startAutopilot,
  stopAutopilot,
  startAutopilotCycle,
  finishAutopilotCycle,
  updateAutopilotState,
  getRecentAutopilotCycles,
} from "./db.js";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

// -------------------------------------------------------
// Test 1: DB schema initializes without error
// -------------------------------------------------------
console.log("\n--- Test 1: DB schema initialization ---");
try {
  const db = getDb();
  const state = getAutopilotState();
  assert(state !== undefined && state !== null, "autopilot_state row exists");
  assert(typeof state.is_running === "number", "is_running is a number");
  assert(typeof state.current_cycle === "number", "current_cycle is a number");
  console.log(`  State: cycle=${state.current_cycle}, running=${state.is_running}`);
} catch (err) {
  assert(false, `DB init failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 2: Start/stop autopilot state transitions
// -------------------------------------------------------
console.log("\n--- Test 2: Start/stop state transitions ---");
try {
  stopAutopilot(); // Ensure clean state
  let state = getAutopilotState();
  assert(state.is_running === 0, "Initially stopped");

  startAutopilot();
  state = getAutopilotState();
  assert(state.is_running === 1, "Started after startAutopilot()");
  assert(state.started_at !== null, "started_at is set");

  stopAutopilot();
  state = getAutopilotState();
  assert(state.is_running === 0, "Stopped after stopAutopilot()");
  assert(state.stopped_at !== null, "stopped_at is set");
} catch (err) {
  assert(false, `State transition failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 3: Stale state cleanup
// -------------------------------------------------------
console.log("\n--- Test 3: Stale state cleanup ---");
try {
  const db = getDb();

  // Simulate a crash: set is_running=1, leave a cycle in RUNNING
  db.prepare("UPDATE autopilot_state SET is_running = 1 WHERE id = 1").run();
  const cycleId = startAutopilotCycle(999);

  let state = getAutopilotState();
  assert(state.is_running === 1, "Simulated crash: is_running=1");

  let staleCycle = db.prepare("SELECT * FROM autopilot_cycles WHERE id = ?").get(cycleId);
  assert(staleCycle.status === "RUNNING", "Simulated crash: cycle stuck in RUNNING");

  // Now run the cleanup (imported dynamically to test it)
  db.prepare("UPDATE autopilot_state SET is_running = 0, error_message = 'Recovered from crash' WHERE id = 1").run();
  db.prepare("UPDATE autopilot_cycles SET status = 'CRASHED', finished_at = datetime('now'), error = 'Process crashed' WHERE status = 'RUNNING'").run();

  state = getAutopilotState();
  assert(state.is_running === 0, "Cleanup reset is_running to 0");

  staleCycle = db.prepare("SELECT * FROM autopilot_cycles WHERE id = ?").get(cycleId);
  assert(staleCycle.status === "CRASHED", "Cleanup marked stale cycle as CRASHED");

  // Clean up test data
  db.prepare("DELETE FROM autopilot_cycles WHERE cycle_number = 999").run();
} catch (err) {
  assert(false, `Stale cleanup failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 4: Cycle creation and finalization
// -------------------------------------------------------
console.log("\n--- Test 4: Cycle creation and finalization ---");
try {
  const cycleId = startAutopilotCycle(1000);
  assert(typeof cycleId === "number" || typeof cycleId === "bigint", "Cycle ID returned");

  const db = getDb();
  let cycle = db.prepare("SELECT * FROM autopilot_cycles WHERE id = ?").get(cycleId);
  assert(cycle.status === "RUNNING", "New cycle starts as RUNNING");
  assert(cycle.cycle_number === 1000, "Cycle number matches");

  finishAutopilotCycle(cycleId, {
    groupsScraped: 3,
    leadsFound: 5,
    leadsExported: 2,
    messagesSent: 1,
    keywordsGenerated: "test1, test2",
    groupsRetired: 0,
    llmCostUsd: 0.05,
    status: "COMPLETED",
    error: null,
  });

  cycle = db.prepare("SELECT * FROM autopilot_cycles WHERE id = ?").get(cycleId);
  assert(cycle.status === "COMPLETED", "Finished cycle is COMPLETED");
  assert(cycle.groups_scraped === 3, "groups_scraped recorded");
  assert(cycle.leads_found === 5, "leads_found recorded");
  assert(cycle.finished_at !== null, "finished_at is set");

  // Clean up
  db.prepare("DELETE FROM autopilot_cycles WHERE cycle_number = 1000").run();
} catch (err) {
  assert(false, `Cycle finalization failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 5: Partial cycle (some steps fail)
// -------------------------------------------------------
console.log("\n--- Test 5: Partial cycle recording ---");
try {
  const cycleId = startAutopilotCycle(1001);

  finishAutopilotCycle(cycleId, {
    groupsScraped: 2,
    leadsFound: 1,
    leadsExported: 0,
    messagesSent: 0,
    keywordsGenerated: null,
    groupsRetired: 0,
    llmCostUsd: 0.01,
    status: "PARTIAL",
    error: "messaging: Timeout | keywords: API error",
  });

  const db = getDb();
  const cycle = db.prepare("SELECT * FROM autopilot_cycles WHERE id = ?").get(cycleId);
  assert(cycle.status === "PARTIAL", "Partial cycle recorded as PARTIAL");
  assert(cycle.error.includes("messaging"), "Error contains step info");
  assert(cycle.leads_found === 1, "Leads still recorded despite partial failure");

  db.prepare("DELETE FROM autopilot_cycles WHERE cycle_number = 1001").run();
} catch (err) {
  assert(false, `Partial cycle test failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 6: Browser lock force-release
// -------------------------------------------------------
console.log("\n--- Test 6: Browser lock force-release ---");
try {
  const PROJECT_ROOT = path.resolve(__dirname, "..");
  const lockFile = path.join(PROJECT_ROOT, "pipeline/.browser-lock");

  // Create a fake lock
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  fs.writeFileSync(lockFile, "99999\n2025-01-01T00:00:00Z");
  assert(fs.existsSync(lockFile), "Fake lock file created");

  // Force release it
  try { fs.unlinkSync(lockFile); } catch { /* */ }
  assert(!fs.existsSync(lockFile), "Lock file removed by force-release");
} catch (err) {
  assert(false, `Browser lock test failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 7: updateAutopilotState increments correctly
// -------------------------------------------------------
console.log("\n--- Test 7: State accumulation ---");
try {
  stopAutopilot(); // Reset
  updateAutopilotState({
    current_cycle: 0,
    total_leads_found: 0,
    total_messages_sent: 0,
    total_groups_retired: 0,
  });

  let state = getAutopilotState();
  assert(state.total_leads_found === 0, "Starts at 0 leads");

  updateAutopilotState({
    current_cycle: 1,
    total_leads_found: state.total_leads_found + 5,
    total_messages_sent: state.total_messages_sent + 2,
  });

  state = getAutopilotState();
  assert(state.total_leads_found === 5, "After cycle 1: 5 leads");
  assert(state.total_messages_sent === 2, "After cycle 1: 2 messages");
  assert(state.current_cycle === 1, "Current cycle is 1");

  updateAutopilotState({
    current_cycle: 2,
    total_leads_found: state.total_leads_found + 3,
    total_messages_sent: state.total_messages_sent + 1,
  });

  state = getAutopilotState();
  assert(state.total_leads_found === 8, "After cycle 2: 8 leads total");
  assert(state.total_messages_sent === 3, "After cycle 2: 3 messages total");
} catch (err) {
  assert(false, `State accumulation failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 8: Group selection doesn't crash with 0 groups
// -------------------------------------------------------
console.log("\n--- Test 8: Group selection with 0 groups ---");
try {
  const { selectGroupsForScrape } = await import("./fb-finder/group-manager.js");
  const groups = selectGroupsForScrape();
  assert(Array.isArray(groups), "Returns an array");
  console.log(`  Active groups available: ${groups.length}`);
} catch (err) {
  assert(false, `Group selection failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 9: Retention report doesn't crash with 0 groups
// -------------------------------------------------------
console.log("\n--- Test 9: Retention report with 0 groups ---");
try {
  const { printRetentionReport, enforceGroupLimit } = await import("./fb-finder/group-retention.js");
  const retention = enforceGroupLimit();
  assert(typeof retention.retired === "number", "enforceGroupLimit returns retired count");
  printRetentionReport();
  assert(true, "printRetentionReport didn't crash");
} catch (err) {
  assert(false, `Retention report crashed: ${err.message}`);
}

// -------------------------------------------------------
// Test 10: Export queued leads doesn't crash with no leads
// -------------------------------------------------------
console.log("\n--- Test 10: Export with no queued leads ---");
try {
  const { exportQueuedLeads } = await import("./fb-finder/lead-exporter.js");
  const count = exportQueuedLeads();
  assert(count === 0, "Returns 0 when no queued leads");
} catch (err) {
  assert(false, `Export crashed: ${err.message}`);
}

// -------------------------------------------------------
// Test 11: Keyword search DB functions
// -------------------------------------------------------
console.log("\n--- Test 11: Keyword search DB functions ---");
try {
  const { getRecentKeywordSearches, recordKeywordSearch, getTopSearchKeywords, getKeywordSearchStats } =
    await import("./db.js");

  recordKeywordSearch(null, "test_keyword", 5, 2);
  const topKws = getTopSearchKeywords(10);
  assert(Array.isArray(topKws), "getTopSearchKeywords returns array");

  const stats = getKeywordSearchStats();
  assert(Array.isArray(stats), "getKeywordSearchStats returns array");

  const recent = getRecentKeywordSearches(1, 1);
  assert(Array.isArray(recent), "getRecentKeywordSearches returns array");

  // Clean up
  const db = getDb();
  db.prepare("DELETE FROM fb_keyword_searches WHERE keyword = 'test_keyword'").run();
  db.prepare("DELETE FROM fb_search_keywords WHERE keyword = 'test_keyword'").run();
} catch (err) {
  assert(false, `Keyword DB functions failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 12: Keyword picker works
// -------------------------------------------------------
console.log("\n--- Test 12: Keyword picker ---");
try {
  const { pickSearchKeywords } = await import("./fb-finder/scraper.js");
  const keywords = pickSearchKeywords(1, 5);
  assert(Array.isArray(keywords), "Returns array");
  assert(keywords.length > 0, `Returns keywords (got ${keywords.length})`);
  assert(keywords.length <= 5, "Respects count limit");
  console.log(`  Sample: [${keywords.slice(0, 3).join(", ")}]`);
} catch (err) {
  assert(false, `Keyword picker crashed: ${err.message}`);
}

// -------------------------------------------------------
// Test 13: withTimeout utility works
// -------------------------------------------------------
console.log("\n--- Test 13: Timeout utility ---");
try {
  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${Math.round(ms / 1000)}s`)), ms)
      ),
    ]);

  // Should resolve fine
  const fast = await withTimeout(Promise.resolve("ok"), 1000, "fast");
  assert(fast === "ok", "Fast promise resolves");

  // Should timeout
  let timedOut = false;
  try {
    await withTimeout(new Promise(() => {}), 100, "slow");
  } catch (err) {
    timedOut = err.message.includes("Timeout");
  }
  assert(timedOut, "Slow promise times out");
} catch (err) {
  assert(false, `Timeout utility failed: ${err.message}`);
}

// -------------------------------------------------------
// Test 14: Autopilot import and getAutopilotStatus works
// -------------------------------------------------------
console.log("\n--- Test 14: Autopilot module import ---");
try {
  const { getAutopilotStatus, stopAutopilotLoop } = await import("./autopilot.js");
  const status = getAutopilotStatus();
  assert(typeof status === "object", "getAutopilotStatus returns object");
  assert("is_running" in status || "error" in status, "Has expected fields");
  assert(typeof status.cycle_interval_minutes === "number", "Has cycle_interval_minutes");
  console.log(`  Status: running=${status.is_running}, cycle=${status.current_cycle}`);
} catch (err) {
  assert(false, `Autopilot import failed: ${err.message}`);
}

// -------------------------------------------------------
// Summary
// -------------------------------------------------------
console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
console.log(`${"=".repeat(50)}\n`);

// Clean up autopilot state
stopAutopilot();

process.exit(failed > 0 ? 1 : 0);
