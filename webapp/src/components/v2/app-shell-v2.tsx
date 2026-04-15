"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  TrendingUp,
  Eye,
  CalendarDays,
  Database,
  Megaphone,
  Globe,
  Sun,
  Brain,
  Shield,
  LogOut,
  Search,
  RefreshCw,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

interface AppShellV2Props {
  children: React.ReactNode;
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

const NAV_ITEMS = [
  { href: "/v2", label: "Dashboard", icon: Home, group: "core" },
  { href: "/v2/threads", label: "Threads", icon: MessageSquare, group: "core" },
  { href: "/v2/leads", label: "Leads", icon: TrendingUp, group: "core" },
  { href: "/v2/watchtower", label: "Watchtower", icon: Eye, group: "core" },
  { href: "/v2/meetings", label: "Meetings", icon: CalendarDays, group: "core" },
  { href: "/v2/intelligence", label: "Intelligence", icon: Database, group: "ai" },
  { href: "/v2/outreach", label: "Outreach", icon: Megaphone, group: "ai" },
  { href: "/v2/operator", label: "Operator", icon: Globe, group: "ai" },
  { href: "/v2/briefing", label: "Briefing", icon: Sun, group: "ai" },
  { href: "/v2/learning", label: "Learning", icon: Brain, group: "sys" },
  { href: "/v2/trust", label: "Trust", icon: Shield, group: "sys" },
];

const GROUP_LABELS: Record<string, string> = {
  core: "Workspace",
  ai: "AI Tools",
  sys: "System",
};

function LiveClock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
      setDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="font-medium tabular-nums text-[var(--v2-text-tertiary)]">
        {time}
      </span>
      <span className="h-3 w-px bg-[rgba(255,255,255,0.06)]" />
      <span className="text-[var(--v2-text-tertiary)]">{date}</span>
    </div>
  );
}

export function AppShellV2({ children, user }: AppShellV2Props) {
  const pathname = usePathname();
  const { syncInProgress, setSyncInProgress } = useAppStore();
  const [syncStep, setSyncStep] = useState("");

  const handleSync = async () => {
    setSyncInProgress(true);
    try {
      setSyncStep("Syncing...");
      await fetch("/api/emails/sync", { method: "POST" });
      setSyncStep("Processing...");
      await fetch("/api/sync/full", { method: "POST" });
      setSyncStep("Done!");
      setTimeout(() => setSyncStep(""), 2000);
    } catch {
      setSyncStep("Failed");
      setTimeout(() => setSyncStep(""), 3000);
    } finally {
      setSyncInProgress(false);
    }
  };

  const isActive = (href: string) =>
    href === "/v2" ? pathname === "/v2" : pathname.startsWith(href);

  const groups = ["core", "ai", "sys"] as const;

  return (
    <div className="flex h-screen bg-[var(--v2-bg-base)] text-[var(--v2-text-primary)]">
      {/* ─── Sidebar ─── */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-[rgba(255,255,255,0.04)] bg-[var(--v2-bg-base)] md:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#00e87b] via-[#00d4a0] to-[#00d4ff] shadow-[0_0_20px_rgba(0,232,123,0.2)]">
            <span className="text-[14px] font-black tracking-tight text-[#08080f]">C</span>
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">
            ClientOps
          </span>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="group flex items-center gap-2.5 rounded-[10px] border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5 transition-all duration-300 focus-within:border-[rgba(0,232,123,0.15)] focus-within:bg-[rgba(0,232,123,0.02)] focus-within:shadow-[0_0_0_3px_rgba(0,232,123,0.04)]">
            <Search className="h-[14px] w-[14px] text-[var(--v2-text-ghost)] transition-colors group-focus-within:text-[#00e87b]" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-transparent text-[12px] text-[var(--v2-text-secondary)] placeholder-[var(--v2-text-ghost)] outline-none"
            />
            <kbd className="hidden rounded bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--v2-text-ghost)] group-focus-within:hidden sm:block">
              /
            </kbd>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pt-1 v2-scrollbar">
          {groups.map((group) => (
            <div key={group} className="mb-1">
              <p className="mb-1.5 px-3 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--v2-text-ghost)]">
                {GROUP_LABELS[group]}
              </p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === group).map(
                  ({ href, label, icon: Icon }) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "group/nav flex items-center gap-3 rounded-[10px] px-3 py-[10px] text-[13px] transition-all duration-200",
                          active
                            ? "bg-gradient-to-r from-[#00e87b] to-[#00d4a0] font-semibold text-[#08080f] v2-nav-active-glow"
                            : "font-medium text-[var(--v2-text-tertiary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--v2-text-secondary)]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[16px] w-[16px] transition-colors",
                            active
                              ? "text-[#08080f]"
                              : "text-[var(--v2-text-ghost)] group-hover/nav:text-[var(--v2-text-tertiary)]"
                          )}
                          strokeWidth={active ? 2.5 : 1.7}
                        />
                        {label}
                      </Link>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-[rgba(255,255,255,0.04)] p-4">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-[10px] object-cover ring-1 ring-[rgba(255,255,255,0.06)]"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[rgba(0,232,123,0.12)] to-[rgba(0,212,255,0.08)] text-[11px] font-bold text-[#00e87b]">
                {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-[var(--v2-text-primary)]">
                {user.name ?? user.email}
              </p>
              {user.name && (
                <p className="truncate text-[10px] text-[var(--v2-text-tertiary)]">
                  {user.email}
                </p>
              )}
            </div>
            <a
              href="/api/auth/logout"
              className="rounded-lg p-1.5 text-[var(--v2-text-ghost)] transition-all hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--v2-text-tertiary)]"
            >
              <LogOut className="h-[14px] w-[14px]" strokeWidth={1.7} />
            </a>
          </div>
        </div>
      </aside>

      {/* ─── Main area ─── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.04)] bg-[var(--v2-bg-base)] px-6">
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#00e87b] to-[#00d4ff] shadow-[0_0_12px_rgba(0,232,123,0.15)]">
              <span className="text-[11px] font-black text-[#08080f]">C</span>
            </div>
          </div>

          <div className="hidden md:flex">
            <LiveClock />
          </div>

          <div className="flex items-center gap-1">
            {syncStep && (
              <span className="mr-2 text-[11px] font-semibold text-[#00e87b] animate-pulse">
                {syncStep}
              </span>
            )}
            <button className="rounded-[10px] p-2.5 text-[var(--v2-text-ghost)] transition-all hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--v2-text-tertiary)]">
              <Bell className="h-[16px] w-[16px]" strokeWidth={1.7} />
            </button>
            <button
              onClick={handleSync}
              disabled={syncInProgress}
              className={cn(
                "flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12px] font-medium transition-all duration-200",
                syncInProgress
                  ? "text-[#00e87b]"
                  : "text-[var(--v2-text-tertiary)] hover:bg-[rgba(0,232,123,0.04)] hover:text-[#00e87b]"
              )}
            >
              <RefreshCw
                className={cn("h-[14px] w-[14px]", syncInProgress && "animate-spin")}
                strokeWidth={2}
              />
              Sync
            </button>
          </div>
        </header>

        {/* Content area with ambient gradient background */}
        <div className="relative flex-1 overflow-y-auto v2-ambient-bg v2-scrollbar">
          <div className="relative z-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
