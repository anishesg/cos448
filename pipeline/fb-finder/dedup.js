import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllFbUserIds, isUserAlreadyLead } from "../db.js";
import { extractFbUserId } from "./selectors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// CSV files to cross-reference for dedup
const CSV_FILES = [
  "fb-commenters.csv",
  "fb-commenters-remaining.csv",
  "fb-group-leads.csv",
];

/**
 * Build a Set of all known FB user IDs from:
 * 1. Existing CSV files (Profile URL column → extract ID)
 * 2. fb_leads table in the DB
 *
 * Call once at the start of each scrape cycle for fast O(1) lookups.
 */
export function buildKnownUserSet() {
  const known = new Set();

  // Load from DB
  for (const userId of getAllFbUserIds()) {
    if (userId) known.add(userId);
  }

  // Load from CSV files
  for (const csvFile of CSV_FILES) {
    const csvPath = path.join(PROJECT_ROOT, csvFile);
    if (!fs.existsSync(csvPath)) continue;

    const content = fs.readFileSync(csvPath, "utf8");
    const lines = content.split("\n");

    // Skip header, parse each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSV format: Name,Profile URL,Message URL,Completed
      // Profile URL is the second column
      const cols = parseCsvLine(line);
      const profileUrl = cols[1];
      const messageUrl = cols[2];

      // Try extracting user ID from profile URL
      const userId = extractFbUserId(profileUrl) || extractFbUserId(messageUrl);
      if (userId) known.add(userId);
    }
  }

  return known;
}

/**
 * Check if a user ID is already known (in CSV or DB).
 */
export function isDuplicate(fbUserId, knownSet) {
  if (!fbUserId) return false;
  return knownSet.has(fbUserId);
}

/**
 * Parse a CSV line handling quoted fields with commas.
 */
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
