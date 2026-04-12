import { config } from "../config.js";
import { getFormResponses } from "../google/sheets.js";
import { insertLead, getMaxFormRow } from "../db.js";

/**
 * Poll the Google Sheet for new form responses and insert them as leads.
 */
export async function runDetectSignups(auth) {
  try {
    const responses = await getFormResponses(auth, config.google.sheetId);
    const maxRow = getMaxFormRow();
    let newCount = 0;

    for (const row of responses) {
      if (row._rowIndex <= maxRow) continue;

      // Attempt to map common Google Form field names.
      // The exact headers depend on the form. We try common patterns.
      const name =
        row["name"] ||
        row["full name"] ||
        row["your name"] ||
        row["parent name"] ||
        row["parent's name"] ||
        "";
      const email =
        row["email"] ||
        row["email address"] ||
        row["your email"] ||
        "";
      const phone =
        row["phone"] ||
        row["phone number"] ||
        row["contact number"] ||
        "";
      const childName =
        row["child's name"] ||
        row["child name"] ||
        row["student name"] ||
        row["student's name"] ||
        "";
      const childGrade =
        row["child's grade"] ||
        row["grade"] ||
        row["current grade"] ||
        "";

      if (!name || !email) {
        console.log(`[detect] Skipping row ${row._rowIndex}: missing name or email`);
        continue;
      }

      const result = insertLead({
        name,
        email,
        phone,
        childName,
        childGrade,
        formRow: row._rowIndex,
      });

      if (result.changes > 0) {
        newCount++;
        console.log(`[detect] New lead: ${name} <${email}> (row ${row._rowIndex})`);
      }
    }

    if (newCount > 0) {
      console.log(`[detect] Inserted ${newCount} new lead(s)`);
    }
  } catch (err) {
    console.error("[detect] Error polling sheet:", err.message);
  }
}
