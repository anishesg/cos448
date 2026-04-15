import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function RootPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  // Check if onboarding is complete
  const [user] = await db
    .select({ businessType: userProfiles.businessType })
    .from(userProfiles)
    .where(eq(userProfiles.id, session.userId))
    .limit(1);

  if (!user?.businessType) redirect("/onboarding");
  redirect("/dashboard");
}
