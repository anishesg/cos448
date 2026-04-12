import { selectGroupsForScrape, printGroupHealthReport } from "../fb-finder/group-manager.js";
import { runScrapeCycle } from "../fb-finder/scraper.js";
import { getTodayBudget } from "../db.js";

/**
 * Orchestrates one scraping cycle:
 * 1. Select groups using explore/exploit
 * 2. Scrape each group
 * 3. Print health report
 */
export async function runScrapeGroups() {
  console.log(`\n[${new Date().toLocaleTimeString()}] Starting group scrape job...`);

  try {
    const budget = getTodayBudget();
    console.log(`Today's LLM spend: $${budget.estimated_cost_usd.toFixed(4)} (${budget.total_calls} calls)`);

    const groups = selectGroupsForScrape();
    if (groups.length === 0) {
      console.log("No groups available for scraping (all in cooldown or retired)");
      return;
    }

    console.log(`Selected ${groups.length} groups:`);
    for (const g of groups) {
      console.log(`  - ${g.group_name || g.group_url} [${g.selectionReason}]`);
    }

    const cycleStats = await runScrapeCycle(groups);
    printGroupHealthReport();

    if (cycleStats) {
      console.log(`Cycle results: ${cycleStats.postsScanned} posts, ${cycleStats.commentsScanned} comments, ${cycleStats.leadsFound} leads`);
    }

    const updatedBudget = getTodayBudget();
    console.log(`LLM spend after scrape: $${updatedBudget.estimated_cost_usd.toFixed(4)} (${updatedBudget.total_calls} calls)`);
  } catch (err) {
    console.error("Scrape groups job error:", err.message);
  }
}
