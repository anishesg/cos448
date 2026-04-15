"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ThreadCard, type EmailThreadData } from "./thread-card";
import { cn } from "@/lib/utils";

interface FeedSectionProps {
  title: string;
  icon: React.ReactNode;
  threads: EmailThreadData[];
  defaultCollapsed?: boolean;
  onSelectThread?: (id: string) => void;
}

export function FeedSection({
  title,
  icon,
  threads,
  defaultCollapsed = false,
  onSelectThread,
}: FeedSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (threads.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 px-1 w-full text-left group"
      >
        {icon}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 group-hover:text-stone-600 transition-colors">
          {title}
        </h2>
        <span className="text-xs text-stone-300">({threads.length})</span>
        <span className="ml-auto text-stone-300">
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      <div
        className={cn(
          "space-y-2 transition-all duration-200",
          collapsed && "hidden"
        )}
      >
        {defaultCollapsed && collapsed ? (
          <Card className="border-stone-200 shadow-none">
            <CardContent className="p-3">
              <p className="text-xs text-stone-400">
                {threads.length} threads — tap to expand
              </p>
            </CardContent>
          </Card>
        ) : (
          threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onSelect={onSelectThread}
            />
          ))
        )}
      </div>
    </div>
  );
}
