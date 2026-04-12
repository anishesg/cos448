import { getDb, retireGroup } from "../db.js";
import { config } from "../config.js";

/**
 * Intelligent group retention system
 * - Keeps only top N groups (default 50)
 * - Retires worst performers when adding new groups
 * - Never retires groups with recent activity
 * - Implements revisit schedule for top performers
 */

const MAX_ACTIVE_GROUPS = parseInt(process.env.MAX_ACTIVE_GROUPS || "50", 10);
const MIN_SCRAPES_BEFORE_RETIREMENT = 3; // Give groups at least 3 chances
const RECENT_ACTIVITY_DAYS = 14; // Protect groups scraped recently

/**
 * Score a group for retention priority
 * Higher score = keep, lower score = retire
 */
function calculateRetentionScore(group) {
  let score = 0;

  // 1. Lead yield rate (most important) - 0-100 points
  score += group.lead_yield_rate * 10000; // Scale up for visibility

  // 2. Total leads found - 0-50 points
  score += Math.min(group.total_leads_found * 5, 50);

  // 3. Recent activity bonus - 0-30 points
  if (group.last_scraped_at) {
    const daysSinceScraped = (Date.now() - new Date(group.last_scraped_at + "Z")) / 86400000;
    if (daysSinceScraped < RECENT_ACTIVITY_DAYS) {
      score += 30 * (1 - daysSinceScraped / RECENT_ACTIVITY_DAYS);
    }
  }

  // 4. Newness bonus - groups with few scrapes get benefit of doubt
  if (group.total_comments_scanned < 50) {
    score += 20; // Not enough data yet
  }

  // 5. Penalize consecutive zeros
  score -= group.consecutive_zeros * 5;

  // 6. Penalize very old groups with no leads
  if (group.total_leads_found === 0 && group.total_comments_scanned > 200) {
    score -= 100;
  }

  return score;
}

/**
 * Enforce max active groups limit by retiring worst performers
 */
export function enforceGroupLimit() {
  const db = getDb();

  const activeGroups = db.prepare("SELECT * FROM fb_groups WHERE status = 'ACTIVE'").all();

  if (activeGroups.length <= MAX_ACTIVE_GROUPS) {
    return { retired: 0, kept: activeGroups.length };
  }

  console.log(`\n📊 Enforcing group limit: ${activeGroups.length} active, max ${MAX_ACTIVE_GROUPS}`);

  // Score all groups
  const scored = activeGroups.map(g => ({
    ...g,
    retentionScore: calculateRetentionScore(g),
  })).sort((a, b) => b.retentionScore - a.retentionScore);

  // Keep top MAX_ACTIVE_GROUPS, retire the rest
  const toKeep = scored.slice(0, MAX_ACTIVE_GROUPS);
  const toRetire = scored.slice(MAX_ACTIVE_GROUPS);

  let retired = 0;
  for (const group of toRetire) {
    // Safety check: don't retire groups that haven't been scraped enough
    if (group.total_comments_scanned < 20) {
      console.log(`  ⚠ Skipping retirement of "${group.group_name}" - not enough data (${group.total_comments_scanned} comments)`);
      continue;
    }

    // Safety check: don't retire recent additions
    const daysSinceAdded = (Date.now() - new Date(group.created_at + "Z")) / 86400000;
    if (daysSinceAdded < 3) {
      console.log(`  ⚠ Skipping retirement of "${group.group_name}" - too new (${daysSinceAdded.toFixed(1)} days old)`);
      continue;
    }

    retireGroup(group.id);
    console.log(`  ✓ Retired: "${group.group_name || group.group_url}" (score: ${group.retentionScore.toFixed(1)}, yield: ${(group.lead_yield_rate * 100).toFixed(2)}%)`);
    retired++;
  }

  console.log(`  Summary: Kept ${toKeep.length}, retired ${retired}`);

  return { retired, kept: toKeep.length };
}

/**
 * Get groups that should be revisited (top performers that haven't been scraped recently)
 */
export function getGroupsForRevisit() {
  const db = getDb();

  // Get top 10 performers that haven't been scraped in the last 48 hours
  return db.prepare(`
    SELECT * FROM fb_groups
    WHERE status = 'ACTIVE'
      AND total_leads_found > 0
      AND (last_scraped_at IS NULL OR last_scraped_at < datetime('now', '-2 days'))
      AND (cooldown_until IS NULL OR cooldown_until < datetime('now'))
    ORDER BY lead_yield_rate DESC, total_leads_found DESC
    LIMIT 10
  `).all();
}

/**
 * Analyze group performance and suggest actions
 */
export function analyzeGroupPerformance() {
  const db = getDb();

  const activeGroups = db.prepare("SELECT * FROM fb_groups WHERE status = 'ACTIVE'").all();
  const totalGroups = activeGroups.length;
  const groupsWithLeads = activeGroups.filter(g => g.total_leads_found > 0).length;
  const totalLeads = activeGroups.reduce((sum, g) => sum + g.total_leads_found, 0);
  const totalComments = activeGroups.reduce((sum, g) => sum + g.total_comments_scanned, 0);
  const avgYield = totalComments > 0 ? (totalLeads / totalComments) * 100 : 0;

  // Top performers
  const topPerformers = activeGroups
    .filter(g => g.total_leads_found > 0)
    .sort((a, b) => b.lead_yield_rate - a.lead_yield_rate)
    .slice(0, 5);

  // Underperformers (scraped enough but no leads)
  const underperformers = activeGroups
    .filter(g => g.total_comments_scanned >= 100 && g.total_leads_found === 0)
    .length;

  // Unproven (not scraped enough yet)
  const unproven = activeGroups.filter(g => g.total_comments_scanned < 50).length;

  return {
    totalGroups,
    groupsWithLeads,
    totalLeads,
    totalComments,
    avgYield,
    topPerformers,
    underperformers,
    unproven,
    capacityRemaining: Math.max(0, MAX_ACTIVE_GROUPS - totalGroups),
  };
}

/**
 * Print group performance report
 */
export function printRetentionReport() {
  const analysis = analyzeGroupPerformance();

  console.log("\n--- Group Retention Report ---");
  console.log(`Total active groups: ${analysis.totalGroups}/${MAX_ACTIVE_GROUPS}`);
  const pctWithLeads = analysis.totalGroups > 0 ? ((analysis.groupsWithLeads / analysis.totalGroups) * 100).toFixed(1) : "0.0";
  console.log(`Groups with leads: ${analysis.groupsWithLeads} (${pctWithLeads}%)`);
  console.log(`Total leads found: ${analysis.totalLeads} from ${analysis.totalComments} comments`);
  console.log(`Average yield: ${analysis.avgYield.toFixed(2)}%`);
  console.log(`Underperformers: ${analysis.underperformers}`);
  console.log(`Unproven (need more scraping): ${analysis.unproven}`);
  console.log(`Capacity remaining: ${analysis.capacityRemaining} slots`);

  if (analysis.topPerformers.length > 0) {
    console.log("\nTop 5 performers:");
    for (const g of analysis.topPerformers) {
      console.log(`  - ${g.group_name || g.group_url.slice(0, 50)} — ${(g.lead_yield_rate * 100).toFixed(2)}% yield, ${g.total_leads_found} leads`);
    }
  }

  console.log("---\n");

  return analysis;
}
