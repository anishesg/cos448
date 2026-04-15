import { requireUser } from "@/lib/auth";
import { AppShellV2 } from "@/components/v2/app-shell-v2";
import "./globals-v2.css";

export default async function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return <AppShellV2 user={user}>{children}</AppShellV2>;
}
