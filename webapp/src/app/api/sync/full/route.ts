import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
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
  const session = await requireUser();

  const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, session.userId))
    .limit(1);

  const businessType = user?.businessType ?? undefined;
  const results: Record<string, unknown> = {};

  try {
    const contactsCreated = await extractContacts(session.userId, businessType);
    results.contactsCreated = contactsCreated;
  } catch (err) {
    console.error("Contact extraction failed:", err);
    results.contactsError = String(err);
  }

  try {
    const classified = await autoClassifyThreads(session.userId, businessType);
    results.classified = classified;
  } catch (err) {
    console.error("Classification failed:", err);
    results.classificationError = String(err);
  }

  try {
    const style = await extractUserTone(session.userId);
    results.toneExtracted = !!style;
  } catch (err) {
    console.error("Tone extraction failed:", err);
    results.toneError = String(err);
  }

  return NextResponse.json({ success: true, results });
}
