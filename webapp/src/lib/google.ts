import { google } from "googleapis";
import { db } from "./db";
import { googleTokens } from "./db/schema";
import { eq } from "drizzle-orm";

const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getUserInfo(accessToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

export async function getAuthedGmailClient(userId: string) {
  const [tokenRow] = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  if (!tokenRow) throw new Error("No Google tokens found for user");

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken,
    expiry_date: tokenRow.tokenExpiry?.getTime(),
  });

  client.on("tokens", async (newTokens) => {
    await db
      .update(googleTokens)
      .set({
        accessToken: newTokens.access_token ?? tokenRow.accessToken,
        tokenExpiry: newTokens.expiry_date
          ? new Date(newTokens.expiry_date)
          : tokenRow.tokenExpiry,
        updatedAt: new Date(),
      })
      .where(eq(googleTokens.userId, userId));
  });

  return google.gmail({ version: "v1", auth: client });
}

export async function getAuthedCalendarClient(userId: string) {
  const [tokenRow] = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);

  if (!tokenRow) throw new Error("No Google tokens found for user");

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken,
    expiry_date: tokenRow.tokenExpiry?.getTime(),
  });

  return google.calendar({ version: "v3", auth: client });
}
