/**
 * Autopilot System — Indefinite, self-healing lead generation loop.
 *
 * Architecture:
 * - Single async while-loop (no setInterval, so cycles never overlap)
 * - Every step wrapped in try/catch (one failure never kills the cycle)
 * - Exponential backoff on consecutive failures (1m → 2m → 4m → cap 30m)
 * - Stale state cleanup on startup (crashed cycles, stuck is_running flag)
 * - Browser lock force-released before each cycle
 * - Graceful shutdown via SIGINT/SIGTERM that lets the current step finish
 * - Unhandled exception/rejection handlers keep the loop alive
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDb,
  getAutopilotState,
  startAutopilot,
  stopAutopilot,
  updateAutopilotState,
  startAutopilotCycle,
  finishAutopilotCycle,
  getTodayBudget,
} from "./db.js";
import { selectGroupsForScrape } from "./fb-finder/group-manager.js";
import { runScrapeCycle } from "./fb-finder/scraper.js";
import { exportQueuedLeads } from "./fb-finder/lead-exporter.js";
import { runMessengerBot, updateLeadStatuses, getUnmessagedLeadCount } from "./fb-finder/messenger-integration.js";
import { generateKeywords } from "./fb-finder/keyword-generator.js";
import { runDiscoverGroups } from "./jobs/discover-groups.js";
import { enforceGroupLimit, printRetentionReport } from "./fb-finder/group-retention.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LEADS_CSV_PATH = path.join(PROJECT_ROOT, "fb-group-leads.csv");
const BROWSER_LOCK_FILE = path.join(PROJECT_ROOT, config.fbFinder.browserLockFile);

const CYCLE_INTERVAL_MS = parseInt(process.env.AUTOPILOT_CYCLE_INTERVAL || "3600000", 10);
const KEYWORD_GEN_INTERVAL_CYCLES = 10;
const DISCOVERY_INTERVAL_CYCLES = 5;
const ENABLE_MESSAGING = process.env.AUTOPILOT_ENABLE_MESSAGING !== "false";

const MAX_BACKOFF_MS = 30 * 60 * 1000; // 30 min
const BASE_BACKOFF_MS = 60 * 1000;     // 1 min

let shuttingDown = false;
let consecutiveFailures = 0;

// --- Utility ---

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(msg) {
  console.log(`[${timestamp()}] ${msg}`);
}

function logError(msg) {
  console.error(`[${timestamp()}] ${msg}`);
}

/**
 * Run a promise with a timeout. Rejects with a descriptive error if it takes too long.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${Math.round(ms / 1000)}s`)), ms)
    ),
  ]);
}

// --- Stale state cleanup ---

function cleanupStaleState() {
  try {
    const db = getDb();

    // If is_running is stuck from a previous crash, reset it
    const state = db.prepare("SELECT * FROM autopilot_state WHERE id = 1").get();
    if (state && state.is_running === 1) {
      log("Cleaning up stale is_running flag from previous crash");
      db.prepare(`
        UPDATE autopilot_state SET is_running = 0, error_message = 'Recovered from crash', updated_at = datetime('now') WHERE id = 1
      `).run();
    }

    // Mark any cycles stuck in RUNNING as CRASHED
    const stale = db.prepare("UPDATE autopilot_cycles SET status = 'CRASHED', finished_at = datetime('now'), error = 'Process crashed before completion' WHERE status = 'RUNNING'").run();
    if (stale.changes > 0) {
      log(`Marked ${stale.changes} stale cycle(s) as CRASHED`);
    }
  } catch (err) {
    logError(`Stale state cleanup error: ${err.message}`);
  }
}

/**
 * Force-release browser lock if it exists (prevents stale locks from blocking us)
 */
function forceReleaseBrowserLock() {
  try {
    if (fs.existsSync(BROWSER_LOCK_FILE)) {
      fs.unlinkSync(BROWSER_LOCK_FILE);
    }
  } catch {
    // Not critical
  }
}

// --- Step runners (each wrapped individually) ---

async function stepScrapeGroups(cycleStats) {
  log("[1/8] Selecting groups to scrape...");
  const groups = selectGroupsForScrape();

  if (groups.length === 0) {
    log("  No groups available for scraping");
    return;
  }

  const exploitCount = groups.filter((g) => g.selectionReason === "exploit").length;
  const exploreCount = groups.filter((g) => g.selectionReason === "explore").length;
  log(`  Selected ${groups.length} groups (${exploitCount} exploit, ${exploreCount} explore)`);

  log("[2/8] Scraping groups...");

  // Force-release lock before scrape so we aren't blocked by our own stale lock
  forceReleaseBrowserLock();

  const scrapeResult = await withTimeout(
    runScrapeCycle(groups),
    config.fbFinder.maxBrowsingMinutes * 60 * 1000 + 120_000, // browsing limit + 2 min buffer
    "scrape cycle"
  );

  cycleStats.groupsScraped = groups.length;
  cycleStats.leadsFound = scrapeResult?.leadsFound || 0;
  log(`  Scrape done: ${scrapeResult?.postsScanned || 0} posts, ${scrapeResult?.leadsFound || 0} leads`);
}

async function stepCountLeads(cycleStats) {
  log("[3/8] Counting LLM spend...");
  const budget = getTodayBudget();
  cycleStats.llmCostUsd = budget.estimated_cost_usd;
  log(`  Today's LLM cost: $${budget.estimated_cost_usd.toFixed(4)} (${budget.total_calls} calls)`);
}

async function stepExportLeads(cycleStats) {
  log("[4/8] Exporting leads to CSV...");
  const exported = exportQueuedLeads();
  cycleStats.leadsExported = exported;
  if (exported > 0) log(`  Exported ${exported} leads`);
}

async function stepMessaging(cycleStats) {
  if (!ENABLE_MESSAGING) {
    log("[5/8] Messaging disabled, skipping");
    return;
  }

  if (cycleStats.leadsExported === 0) {
    log("[5/8] No new leads to message");
    return;
  }

  log("[5/8] Messaging leads...");
  const msgResult = await withTimeout(
    runMessengerBot(LEADS_CSV_PATH),
    10 * 60 * 1000, // 10 min timeout for messaging
    "messenger bot"
  );
  cycleStats.messagesSent = msgResult?.sent || 0;
  log(`  Sent ${cycleStats.messagesSent} messages`);

  updateLeadStatuses(LEADS_CSV_PATH);
}

async function stepGenerateKeywords(cycleNumber, cycleStats) {
  if (cycleNumber % KEYWORD_GEN_INTERVAL_CYCLES !== 0) {
    const nextGen = Math.ceil(cycleNumber / KEYWORD_GEN_INTERVAL_CYCLES) * KEYWORD_GEN_INTERVAL_CYCLES;
    log(`[6/8] Keyword generation scheduled for cycle #${nextGen}`);
    return;
  }

  log("[6/8] Generating new keywords with LLM...");
  const result = await withTimeout(
    generateKeywords(),
    2 * 60 * 1000, // 2 min timeout for LLM
    "keyword generation"
  );
  const allKws = [...(result?.discoveryKeywords || []), ...(result?.searchKeywords || [])];
  cycleStats.keywordsGenerated = allKws.join(", ");
  log(`  Generated ${result?.discoveryKeywords?.length || 0} discovery + ${result?.searchKeywords?.length || 0} search keywords`);
}

async function stepDiscoverGroups(cycleNumber) {
  if (cycleNumber % DISCOVERY_INTERVAL_CYCLES !== 0) {
    const nextDisc = Math.ceil(cycleNumber / DISCOVERY_INTERVAL_CYCLES) * DISCOVERY_INTERVAL_CYCLES;
    log(`[7/8] Group discovery scheduled for cycle #${nextDisc}`);
    return;
  }

  log("[7/8] Discovering new groups...");
  forceReleaseBrowserLock();
  await withTimeout(
    runDiscoverGroups(),
    5 * 60 * 1000, // 5 min timeout for discovery
    "group discovery"
  );
}

async function stepRetention(cycleStats) {
  log("[8/8] Managing group retention...");
  const retention = enforceGroupLimit();
  cycleStats.groupsRetired = retention?.retired || 0;

  try {
    printRetentionReport();
  } catch {
    // Non-fatal — report can fail if 0 groups
  }
}

// --- Main cycle ---

async function runAutopilotCycle() {
  // Re-check shutdown flag before starting
  if (shuttingDown) return;

  const state = getAutopilotState();
  if (!state || !state.is_running) {
    log("Autopilot not marked as running in DB, stopping");
    shuttingDown = true;
    return;
  }

  const cycleNumber = state.current_cycle + 1;
  let cycleId;
  try {
    cycleId = startAutopilotCycle(cycleNumber);
  } catch (err) {
    logError(`Failed to start cycle record: ${err.message}`);
    return;
  }

  log(`${"=".repeat(70)}`);
  log(`AUTOPILOT CYCLE #${cycleNumber}`);
  log(`${"=".repeat(70)}`);

  const cycleStats = {
    groupsScraped: 0,
    leadsFound: 0,
    leadsExported: 0,
    messagesSent: 0,
    keywordsGenerated: null,
    groupsRetired: 0,
    llmCostUsd: 0,
    status: "COMPLETED",
    error: null,
  };

  const stepErrors = [];

  // Run each step independently — one failure doesn't kill the rest
  const steps = [
    ["scrape", () => stepScrapeGroups(cycleStats)],
    ["count_leads", () => stepCountLeads(cycleStats)],
    ["export", () => stepExportLeads(cycleStats)],
    ["messaging", () => stepMessaging(cycleStats)],
    ["keywords", () => stepGenerateKeywords(cycleNumber, cycleStats)],
    ["discovery", () => stepDiscoverGroups(cycleNumber)],
    ["retention", () => stepRetention(cycleStats)],
  ];

  for (const [name, fn] of steps) {
    if (shuttingDown) {
      log(`Shutdown requested, skipping remaining steps`);
      break;
    }

    try {
      await fn();
    } catch (err) {
      logError(`Step "${name}" failed: ${err.message}`);
      stepErrors.push(`${name}: ${err.message}`);
    }
  }

  // Finalize cycle
  if (stepErrors.length > 0) {
    cycleStats.status = stepErrors.length >= 4 ? "ERROR" : "PARTIAL";
    cycleStats.error = stepErrors.join(" | ");
  }

  try {
    updateAutopilotState({
      current_cycle: cycleNumber,
      last_cycle_at: new Date().toISOString(),
      total_leads_found: (state.total_leads_found || 0) + cycleStats.leadsFound,
      total_messages_sent: (state.total_messages_sent || 0) + cycleStats.messagesSent,
      total_groups_retired: (state.total_groups_retired || 0) + cycleStats.groupsRetired,
      generated_keywords: cycleStats.keywordsGenerated || state.generated_keywords,
      error_message: stepErrors.length > 0 ? stepErrors[0] : null,
    });
    finishAutopilotCycle(cycleId, cycleStats);
  } catch (err) {
    logError(`Failed to finalize cycle: ${err.message}`);
  }

  log(`${"=".repeat(70)}`);
  log(`CYCLE #${cycleNumber} ${cycleStats.status}`);
  log(`  Scraped: ${cycleStats.groupsScraped} groups | Found: ${cycleStats.leadsFound} leads`);
  log(`  Exported: ${cycleStats.leadsExported} | Messaged: ${cycleStats.messagesSent}`);
  log(`  Retired: ${cycleStats.groupsRetired} groups | LLM: $${cycleStats.llmCostUsd.toFixed(4)}`);
  if (stepErrors.length > 0) log(`  Errors: ${stepErrors.length} step(s) failed`);
  log(`${"=".repeat(70)}\n`);

  // Track consecutive failures for backoff
  if (cycleStats.status === "ERROR") {
    consecutiveFailures++;
  } else {
    consecutiveFailures = 0;
  }
}

// --- Main loop (replaces setInterval — never overlaps) ---

async function autopilotLoop() {
  log("Entering indefinite autopilot loop...");

  while (!shuttingDown) {
    try {
      await runAutopilotCycle();
    } catch (err) {
      // This should almost never happen since runAutopilotCycle is fully wrapped,
      // but just in case, catch it and keep going.
      logError(`Unexpected cycle-level error: ${err.message}`);
      consecutiveFailures++;
    }

    if (shuttingDown) break;

    // Calculate wait: normal interval, or exponential backoff if failing
    let waitMs = CYCLE_INTERVAL_MS;
    if (consecutiveFailures > 0) {
      const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, consecutiveFailures - 1), MAX_BACKOFF_MS);
      waitMs = Math.max(waitMs, backoff);
      log(`Consecutive failures: ${consecutiveFailures}, backing off ${Math.round(waitMs / 1000)}s`);
    }

    log(`Next cycle in ${Math.round(waitMs / 60000)} minutes (${new Date(Date.now() + waitMs).toLocaleTimeString()})`);

    // Sleep in small increments so we can respond to shutdown quickly
    const sleepChunkMs = 5000;
    let slept = 0;
    while (slept < waitMs && !shuttingDown) {
      await sleep(Math.min(sleepChunkMs, waitMs - slept));
      slept += sleepChunkMs;
    }
  }

  log("Autopilot loop exited");
}

// --- Public API ---

export async function startAutopilotLoop() {
  // Clean up any stale state from a previous crash
  cleanupStaleState();

  log("Starting Autopilot System...");
  log(`  Cycle interval: ${CYCLE_INTERVAL_MS / 60000} minutes`);
  log(`  Messaging: ${ENABLE_MESSAGING ? "enabled" : "disabled"}`);
  log(`  Test mode: ${config.fbFinder.testMode ? "enabled" : "disabled"}`);

  startAutopilot();
  shuttingDown = false;
  consecutiveFailures = 0;

  // Run the loop (this never returns until shutdown)
  await autopilotLoop();

  log("Autopilot system stopped");
  return { success: true };
}

export function stopAutopilotLoop() {
  log("Stopping Autopilot System...");
  shuttingDown = true;
  try {
    stopAutopilot();
  } catch (err) {
    logError(`Error updating DB stop state: ${err.message}`);
  }
  forceReleaseBrowserLock();
  log("Autopilot stop requested (will finish current step)");
  return { success: true };
}

export function getAutopilotStatus() {
  try {
    const state = getAutopilotState();
    const unmessaged = getUnmessagedLeadCount();
    return {
      ...state,
      unmessaged_leads: unmessaged,
      cycle_interval_minutes: CYCLE_INTERVAL_MS / 60000,
      messaging_enabled: ENABLE_MESSAGING,
      test_mode: config.fbFinder.testMode,
      consecutive_failures: consecutiveFailures,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// --- Process-level safety nets ---

process.on("SIGINT", () => {
  log("Received SIGINT, shutting down gracefully...");
  stopAutopilotLoop();
  // Give it 10 seconds to finish the current step, then force exit
  setTimeout(() => {
    logError("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000);
});

process.on("SIGTERM", () => {
  log("Received SIGTERM, shutting down gracefully...");
  stopAutopilotLoop();
  setTimeout(() => process.exit(1), 10000);
});

process.on("uncaughtException", (err) => {
  logError(`UNCAUGHT EXCEPTION (autopilot stays alive): ${err.message}`);
  logError(err.stack || "");
  consecutiveFailures++;
  forceReleaseBrowserLock();
  // Don't exit — the loop will continue
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  logError(`UNHANDLED REJECTION (autopilot stays alive): ${msg}`);
  consecutiveFailures++;
  forceReleaseBrowserLock();
});

// --- Auto-start when run directly ---

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  startAutopilotLoop().catch((err) => {
    logError(`Autopilot failed to start: ${err.message}`);
    process.exit(1);
  });
}
