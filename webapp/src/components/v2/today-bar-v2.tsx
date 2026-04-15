"use client";

import { cn } from "@/lib/utils";
import { Flame, AlertTriangle, Send, EyeOff, Sparkles, Clock } from "lucide-react";

interface TodayBarV2Props {
  hotLeads: number;
  clientRisks: number;
  repliesReady: number;
  hiddenThreads: number;
  draftsReady?: number;
  schedulingOpportunities?: number;
}

export function TodayBarV2({
  hotLeads,
  clientRisks,
  repliesReady,
  hiddenThreads,
  draftsReady = 0,
  schedulingOpportunities = 0,
}: TodayBarV2Props) {
  const items = [
    { count: hotLeads, label: "hot leads", icon: Flame, color: "text-[#ff4060]", bg: "bg-[rgba(255,64,96,0.06)] border-[rgba(255,64,96,0.08)]" },
    { count: clientRisks, label: "at risk", icon: AlertTriangle, color: "text-[#ffb800]", bg: "bg-[rgba(255,184,0,0.06)] border-[rgba(255,184,0,0.08)]" },
    { count: draftsReady, label: "drafts", icon: Sparkles, color: "text-[#a855f7]", bg: "bg-[rgba(168,85,247,0.06)] border-[rgba(168,85,247,0.08)]" },
    { count: repliesReady, label: "needs reply", icon: Send, color: "text-[#00e87b]", bg: "bg-[rgba(0,232,123,0.06)] border-[rgba(0,232,123,0.08)]" },
    { count: schedulingOpportunities, label: "to schedule", icon: Clock, color: "text-[#00d4ff]", bg: "bg-[rgba(0,212,255,0.06)] border-[rgba(0,212,255,0.08)]" },
    { count: hiddenThreads, label: "hidden", icon: EyeOff, color: "text-[var(--v2-text-ghost)]", bg: "bg-[rgba(255,255,255,0.015)] border-[rgba(255,255,255,0.04)]" },
  ].filter((item) => item.count > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(({ count, label, icon: Icon, color, bg }) => (
        <div
          key={label}
          className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 transition-all", bg)}
        >
          <Icon className={cn("h-3.5 w-3.5", color)} strokeWidth={2} />
          <span className="text-[12px] font-bold text-white tabular-nums">{count}</span>
          <span className="text-[11px] font-medium text-[var(--v2-text-tertiary)]">{label}</span>
        </div>
      ))}
    </div>
  );
}
