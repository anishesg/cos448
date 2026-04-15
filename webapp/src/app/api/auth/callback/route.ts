import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getUserInfo } from "@/lib/google";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfiles, googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  console.log("[OAuth Callback] Full URL:", url.toString());
  console.log("[OAuth Callback] Search params:", Object.fromEntries(url.searchParams.entries()));

  const error = url.searchParams.get("error");
  if (error) {
    console.error("[OAuth Callback] Google returned error:", error, url.searchParams.get("error_description"));
    return NextResponse.redirect(
      new URL(`/login?error=${error}`, request.url)
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    console.error("[OAuth Callback] No code in params. All params:", Object.fromEntries(url.searchParams.entries()));
    return NextResponse.redirect(
      new URL("/login?error=no_code", request.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL("/login?error=no_access_token", request.url)
      );
    }

    const userInfo = await getUserInfo(tokens.access_token);
    if (!userInfo.email) {
      return NextResponse.redirect(
        new URL("/login?error=no_email", request.url)
      );
    }

    // Upsert user profile
    const existing = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.email, userInfo.email))
      .limit(1);

    let userId: string;

    if (existing.length > 0) {
      userId = existing[0].id;
      await db
        .update(userProfiles)
        .set({
          name: userInfo.name ?? existing[0].name,
          avatarUrl: userInfo.picture ?? existing[0].avatarUrl,
          googleId: userInfo.id ?? existing[0].googleId,
        })
        .where(eq(userProfiles.id, userId));
    } else {
      const [newUser] = await db
        .insert(userProfiles)
        .values({
          email: userInfo.email,
          name: userInfo.name ?? null,
          avatarUrl: userInfo.picture ?? null,
          googleId: userInfo.id ?? null,
        })
        .returning({ id: userProfiles.id });
      userId = newUser.id;
    }

    // Upsert Google tokens
    const existingTokens = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, userId))
      .limit(1);

    const tokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existingTokens[0]?.refreshToken ?? "",
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope ?? null,
      updatedAt: new Date(),
    };

    if (existingTokens.length > 0) {
      await db
        .update(googleTokens)
        .set(tokenData)
        .where(eq(googleTokens.userId, userId));
    } else {
      await db.insert(googleTokens).values({ userId, ...tokenData });
    }

    // Set session cookie
    const session = await getSession();
    session.userId = userId;
    session.email = userInfo.email;
    session.name = userInfo.name ?? null;
    session.avatarUrl = userInfo.picture ?? null;
    await session.save();

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", request.url)
    );
  }
}
