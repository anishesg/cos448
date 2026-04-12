import {
  getActiveGroups,
  getGroupsSortedByYield,
  retireGroup,
  getGroupById,
} from "../db.js";
import { config } from "../config.js";

/**
 * Select groups for the next scrape cycle using explore/exploit strategy.
 *
 * - Exploit (75%): Top groups by yield rate (min 50 comments scanned)
 * - Explore (25%): Least-explored groups (fewest total comments scanned)
 *
 * Skips groups that are still in cooldown.
 */
export function selectGroupsForScrape() {
  const { groupsPerScrape, exploreRatio, cooldownMinutes, testMode } = config.fbFinder;
  const now = new Date();

  const activeGroups = getActiveGroups().filter((g) => {
    // Skip groups still in cooldown (unless test mode)
    if (!testMode && g.cooldown_until && new Date(g.cooldown_until + "Z") > now) return false;
    return true;
  });

  if (activeGroups.length === 0) return [];

  const exploitCount = Math.ceil(groupsPerScrape * (1 - exploreRatio));
  const exploreCount = groupsPerScrape - exploitCount;

  // Exploit: highest yield rate, at least 50 comments scanned
  const proven = activeGroups
    .filter((g) => g.total_comments_scanned >= 50)
    .sort((a, b) => b.lead_yield_rate - a.lead_yield_rate);

  // Explore: least explored groups
  const unproven = activeGroups
    .sort((a, b) => a.total_comments_scanned - b.total_comments_scanned);

  const selected = new Set();
  const result = [];

  // Pick exploit groups
  for (const g of proven) {
    if (result.length >= exploitCount) break;
    if (!selected.has(g.id)) {
      selected.add(g.id);
      result.push({ ...g, selectionReason: "exploit" });
    }
  }

  // Pick explore groups
  for (const g of unproven) {
    if (result.length >= groupsPerScrape) break;
    if (!selected.has(g.id)) {
      selected.add(g.id);
      result.push({ ...g, selectionReason: "explore" });
    }
  }

  // If we still don't have enough, fill with any remaining active groups
  for (const g of activeGroups) {
    if (result.length >= groupsPerScrape) break;
    if (!selected.has(g.id)) {
      selected.add(g.id);
      result.push({ ...g, selectionReason: "fill" });
    }
  }

  return result;
}

/**
 * Check if a group should be retired based on performance.
 * - 200+ comments scanned AND yield rate below threshold → retire
 * - 3+ consecutive zero-lead scrapes → exponential cooldown, 5+ → retire
 */
export function evaluateGroupHealth(groupId) {
  const group = getGroupById(groupId);
  if (!group || group.status !== "ACTIVE") return;

  const { minYieldRate, cooldownMinutes } = config.fbFinder;

  // Retire underperformers
  if (group.total_comments_scanned >= 200 && group.lead_yield_rate < minYieldRate) {
    console.log(`Retiring group "${group.group_name}" (${group.group_url}) — yield ${(group.lead_yield_rate * 100).toFixed(2)}% below ${(minYieldRate * 100).toFixed(2)}% after ${group.total_comments_scanned} comments`);
    retireGroup(groupId);
    return;
  }

  // Exponential cooldown for consecutive zeros
  if (group.consecutive_zeros >= 5) {
    console.log(`Retiring group "${group.group_name}" — 5+ consecutive zero-lead scrapes`);
    retireGroup(groupId);
    return;
  }

  if (group.consecutive_zeros >= 3) {
    const multiplier = Math.pow(2, group.consecutive_zeros - 2);
    const extendedCooldown = cooldownMinutes * multiplier;
    console.log(`Extended cooldown for "${group.group_name}" — ${extendedCooldown} min (${group.consecutive_zeros} consecutive zeros)`);
  }
}

/**
 * Print a summary of group health and performance.
 */
export function printGroupHealthReport() {
  const groups = getGroupsSortedByYield();

  console.log("\n--- Group Health Report ---");
  console.log(`Active groups: ${groups.length}`);

  if (groups.length === 0) {
    console.log("No active groups.\n");
    return;
  }

  console.log("\nTop performers:");
  const top = groups.slice(0, 5);
  for (const g of top) {
    console.log(`  ${g.group_name || g.group_url} — yield: ${(g.lead_yield_rate * 100).toFixed(2)}%, leads: ${g.total_leads_found}, comments: ${g.total_comments_scanned}`);
  }

  const totalLeads = groups.reduce((s, g) => s + g.total_leads_found, 0);
  const totalComments = groups.reduce((s, g) => s + g.total_comments_scanned, 0);
  console.log(`\nTotals: ${totalLeads} leads from ${totalComments} comments across ${groups.length} groups`);
  console.log("---\n");
}
