import { exportQueuedLeads } from "../fb-finder/lead-exporter.js";
import { getTodayBudget } from "../db.js";

/**
 * Job: export queued FB leads to CSV for the messenger bot.
 * Runs every 2 hours.
 */
export async function runExportLeads() {
  console.log(`\n[${new Date().toLocaleTimeString()}] Running lead export job...`);

  try {
    const count = exportQueuedLeads();
    if (count > 0) {
      console.log(`Exported ${count} leads to CSV`);
    }

    // Print daily summary
    const budget = getTodayBudget();
    console.log(`Daily LLM stats: ${budget.total_calls} calls, $${budget.estimated_cost_usd.toFixed(4)} spent`);
  } catch (err) {
    console.error("Export leads job error:", err.message);
  }
}
