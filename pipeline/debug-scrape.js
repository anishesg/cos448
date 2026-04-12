import { selectGroupsForScrape } from './fb-finder/group-manager.js';
import { getActiveGroups } from './db.js';
import { config } from './config.js';

console.log('=== Debugging Group Selection ===\n');

// Check config
console.log('Config:');
console.log('  groupsPerScrape:', config.fbFinder.groupsPerScrape);
console.log('  exploreRatio:', config.fbFinder.exploreRatio);
console.log('  cooldownMinutes:', config.fbFinder.cooldownMinutes);

// Check active groups
const activeGroups = getActiveGroups();
console.log('\nActive groups (status=ACTIVE):', activeGroups.length);

// Check cooldown filtering
const now = new Date();
console.log('Current time:', now.toISOString());

const filtered = activeGroups.filter((g) => {
  if (g.cooldown_until) {
    const cooldownDate = new Date(g.cooldown_until + 'Z');
    const inCooldown = cooldownDate > now;
    if (inCooldown) {
      console.log(`  Group ${g.id} IN COOLDOWN until ${cooldownDate.toISOString()}`);
    }
    return !inCooldown;
  }
  return true;
});

console.log('\nGroups after cooldown filter:', filtered.length);

// Try selection
console.log('\nRunning selectGroupsForScrape...');
const selected = selectGroupsForScrape();
console.log('Selected groups:', selected.length);

if (selected.length > 0) {
  console.log('\nSelected:');
  for (const g of selected) {
    console.log(`  - ${g.group_name || g.group_url} [${g.selectionReason}]`);
  }
} else {
  console.log('\n❌ No groups selected!');

  // More debugging
  if (filtered.length === 0) {
    console.log('Problem: All groups are in cooldown');
  } else {
    console.log('Problem: Groups available but not being selected');
    console.log('First available group:', filtered[0]);
  }
}
