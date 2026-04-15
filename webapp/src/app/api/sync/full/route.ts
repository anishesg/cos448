import { NextResponse } from "next/server";
import { requireApiUser, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractContacts } from "@/lib/pipeline/extract-contacts";
import {
  autoClassifyThreads,
  extractUserTone,
} from "@/lib/pipeline/auto-classify";

export const maxDuration = 120;

export async function POST() {
  try {
    const session = await requireApiUser();

    const [user] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, session.userId))
      .limit(1);

    const businessType = user?.businessType ?? undefined;
    const results: Record<string, unknown> = {};
    let hasErrors = false;

    try {
      const contactsCreated = await extractContacts(session.userId, businessType);
      results.contactsCreated = contactsCreated;
    } catch (err) {
      console.error("Contact extraction failed:", err);
      results.contactsError = "Contact extraction failed";
      hasErrors = true;
    }

    try {
      const classified = await autoClassifyThreads(session.userId, businessType);
      results.classified = classified;
    } catch (err) {
      console.error("Classification failed:", err);
      results.classificationError = "Classification failed";
      hasErrors = true;
    }

    try {
      const style = await extractUserTone(session.userId);
      results.toneExtracted = !!style;
    } catch (err) {
      console.error("Tone extraction failed:", err);
      results.toneError = "Tone extraction failed";
      hasErrors = true;
    }

    return NextResponse.json({ success: !hasErrors, partial: hasErrors, results });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Full sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
