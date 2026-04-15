import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const user = await requireUser();

  const allContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.userId, user.userId))
    .orderBy(desc(contacts.lastContactAt));

  return NextResponse.json({ contacts: allContacts });
}
