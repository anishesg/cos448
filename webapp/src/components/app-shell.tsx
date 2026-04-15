"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  Eye,
  Shield,
  CalendarDays,
  Megaphone,
  Sun,
  Brain,
  Globe,
  LogOut,
  RefreshCw,
  TrendingUp,
  Database,
  Beaker,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/threads", label: "Threads", icon: MessageSquare },
  { href: "/dashboard/leads", label: "Leads", icon: TrendingUp },
  { href: "/dashboard/watchtower", label: "Watchtower", icon: Eye },
  { href: "/dashboard/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/dashboard/intelligence", label: "Intelligence", icon: Database },
  { href: "/dashboard/outreach", label: "Outreach", icon: Megaphone },
  { href: "/dashboard/operator", label: "Operator", icon: Globe },
  { href: "/dashboard/briefing", label: "Briefing", icon: Sun },
  { href: "/dashboard/learning", label: "Learning", icon: Brain },
  { href: "/dashboard/trust", label: "Trust", icon: Shield },
  { href: "/dashboard/test", label: "Test Lab", icon: Beaker },
];

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const { syncInProgress, setSyncInProgress } = useAppStore();
  const [syncStep, setSyncStep] = useState("");

  const handleSync = async () => {
    setSyncInProgress(true);
    try {
      setSyncStep("Fetching emails...");
      await fetch("/api/emails/sync", { method: "POST" });

      setSyncStep("Processing contacts, classifying, drafting...");
      await fetch("/api/sync/full", { method: "POST" });

      setSyncStep("Done!");
      setTimeout(() => setSyncStep(""), 2000);
    } catch (err) {
      console.error("Sync failed:", err);
      setSyncStep("Sync failed");
      setTimeout(() => setSyncStep(""), 3000);
    } finally {
      setSyncInProgress(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-stone-200 bg-stone-50/50 md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-stone-200 px-4">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-xs font-bold text-white">C</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-stone-900">
            ClientOps
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-stone-200/70 text-stone-900"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-stone-200 p-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[10px] bg-stone-200 text-stone-600">
                {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-stone-700 truncate">
                {user.name ?? user.email}
              </p>
            </div>
            <a
              href="/api/auth/logout"
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile nav + sync) */}
        <header className="flex h-14 items-center justify-between border-b border-stone-200 px-4 md:px-6">
          <div className="flex items-center gap-4 md:hidden">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">C</span>
            </div>
            <nav className="flex gap-1">
              {NAV_ITEMS.map(({ href, icon: Icon }) => {
                const active =
                  href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "rounded-md p-1.5",
                      active
                        ? "bg-stone-200/70 text-stone-900"
                        : "text-stone-400"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden md:block" />

          <div className="flex items-center gap-2">
            {syncStep && (
              <span className="text-[11px] text-indigo-600 animate-pulse">
                {syncStep}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncInProgress}
              className="text-stone-500 hover:text-stone-700 text-xs gap-1.5"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", syncInProgress && "animate-spin")}
              />
              {syncInProgress ? "Syncing..." : "Sync & Process"}
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
