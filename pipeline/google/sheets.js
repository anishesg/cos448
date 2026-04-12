import { google } from "googleapis";

/**
 * Fetch all rows from the form responses sheet.
 * Returns array of row objects (header-keyed), plus the raw row index.
 */
export async function getFormResponses(auth, sheetId) {
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Form Responses 1",
  });

  const rows = response.data.values || [];
  if (rows.length < 2) return []; // header only or empty

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = { _rowIndex: i + 1 }; // 1-indexed sheet row
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (row[j] || "").trim();
    }
    dataRows.push(obj);
  }

  return dataRows;
}
