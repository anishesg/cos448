import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getQueuedFbLeads, updateFbLeadState } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const CSV_PATH = path.join(PROJECT_ROOT, "fb-group-leads.csv");
const CSV_HEADER = "Name,Profile URL,Message URL,Completed";

/**
 * Export queued FB leads to CSV in the format the messenger bot expects:
 * Name,Profile URL,Message URL,Completed
 *
 * Updates each lead's outreach_state to EXPORTED_CSV.
 */
export function exportQueuedLeads() {
  const leads = getQueuedFbLeads();
  if (leads.length === 0) {
    console.log("No queued leads to export");
    return 0;
  }

  // Create or append to CSV
  let needsHeader = false;
  if (!fs.existsSync(CSV_PATH)) {
    needsHeader = true;
  } else {
    const content = fs.readFileSync(CSV_PATH, "utf8").trim();
    if (!content) needsHeader = true;
  }

  const lines = [];
  if (needsHeader) lines.push(CSV_HEADER);

  for (const lead of leads) {
    const name = escapeCsv(lead.name);
    const profileUrl = escapeCsv(lead.profile_url);
    const messageUrl = escapeCsv(lead.message_url || `https://www.facebook.com/messages/t/${lead.fb_user_id}`);
    lines.push(`${name},${profileUrl},${messageUrl},`);

    // Mark as exported
    updateFbLeadState(lead.id, "EXPORTED_CSV", {
      exported_at: new Date().toISOString(),
    });
  }

  fs.appendFileSync(CSV_PATH, (needsHeader ? "" : "\n") + lines.join("\n") + "\n");
  console.log(`Exported ${leads.length} leads to ${CSV_PATH}`);
  return leads.length;
}

function escapeCsv(value) {
  const str = String(value || "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
