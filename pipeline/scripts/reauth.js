#!/usr/bin/env node
/**
 * One-time script to re-authorize with expanded scopes.
 * Run: node scripts/reauth.js
 *
 * 1. Opens browser for consent
 * 2. Starts a tiny HTTP server to catch the redirect
 * 3. Exchanges code for tokens
 * 4. Prints the new refresh token to paste into .env
 */
import "dotenv/config";
import http from "node:http";
import { URL } from "node:url";
import open from "open";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/api/auth/google/callback`;

const client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("\nOpening browser for Google authorization...\n");
console.log("If the browser doesn't open, visit this URL manually:");
console.log(authUrl);
console.log();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (!url.pathname.startsWith("/api/auth/google/callback")) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("Missing code parameter");
    return;
  }

  try {
    const { tokens } = await client.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Authorization successful!</h1><p>You can close this tab.</p>");

    console.log("=== Authorization successful ===\n");
    console.log("Update your .env with this refresh token:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    if (tokens.access_token) {
      console.log(`Access token (temporary): ${tokens.access_token.slice(0, 30)}...`);
    }
    console.log(`\nScopes granted: ${tokens.scope}`);
  } catch (err) {
    res.writeHead(500);
    res.end("Token exchange failed");
    console.error("Token exchange failed:", err.message);
  }

  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT} for OAuth callback...\n`);
  open(authUrl).catch(() => {});
});
