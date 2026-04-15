"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThreadCardV2, type EmailThreadData } from "./thread-card-v2";

interface FeedSectionV2Props {
  title: string;
  icon: React.ReactNode;
  threads: EmailThreadData[];
  defaultCollapsed?: boolean;
  onSelectThread?: (id: string) => void;
}

export function FeedSectionV2({
  title,
  icon,
  threads,
  defaultCollapsed = false,
  onSelectThread,
}: FeedSectionV2Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (threads.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2.5 py-1 text-left transition-all"
      >
        {icon}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--v2-text-tertiary)]">
          {title}
        </h2>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-[rgba(255,255,255,0.03)] px-1.5 text-[10px] font-bold tabular-nums text-[var(--v2-text-ghost)]">
          {threads.length}
        </span>
        <span className="ml-auto text-[var(--v2-text-ghost)]">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      <div className={cn("space-y-2 transition-all duration-200", collapsed && "hidden")}>
        {threads.map((thread) => (
          <ThreadCardV2 key={thread.id} thread={thread} onSelect={onSelectThread} />
        ))}
      </div>
    </div>
  );
}
