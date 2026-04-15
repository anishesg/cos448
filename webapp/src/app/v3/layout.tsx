import { requireUser } from "@/lib/auth";
import { AppShellV3 } from "@/components/v3/app-shell-v3";
import "./globals-v3.css";

export default async function V3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return <AppShellV3 user={user}>{children}</AppShellV3>;
}
