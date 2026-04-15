"use client";

import {
  Flame,
  AlertTriangle,
  Send,
  CalendarX,
  EyeOff,
  Sparkles,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TodayBarProps {
  hotLeads: number;
  clientRisks: number;
  repliesReady: number;
  calendarConflicts: number;
  hiddenThreads: number;
  draftsReady?: number;
  schedulingOpportunities?: number;
}

export function TodayBar({
  hotLeads,
  clientRisks,
  repliesReady,
  calendarConflicts,
  hiddenThreads,
  draftsReady = 0,
  schedulingOpportunities = 0,
}: TodayBarProps) {
  const items = [
    { count: hotLeads, label: "hot lead", icon: Flame, color: "text-red-500" },
    {
      count: clientRisks,
      label: "client risk",
      icon: AlertTriangle,
      color: "text-amber-500",
    },
    {
      count: draftsReady,
      label: "draft ready",
      icon: Sparkles,
      color: "text-indigo-500",
    },
    {
      count: repliesReady,
      label: "needs reply",
      icon: Send,
      color: "text-emerald-500",
    },
    {
      count: schedulingOpportunities,
      label: "to schedule",
      icon: Clock,
      color: "text-blue-500",
    },
    {
      count: calendarConflicts,
      label: "calendar conflict",
      icon: CalendarX,
      color: "text-orange-500",
    },
    {
      count: hiddenThreads,
      label: "hidden",
      icon: EyeOff,
      color: "text-stone-400",
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) return null;

  return (
    <Card className="border-stone-200 shadow-none bg-stone-50/80">
      <CardContent className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {items.map(({ count, label, icon: Icon, color }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 text-xs text-stone-600"
            >
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="font-semibold">{count}</span>
              <span>
                {label}
                {count !== 1 ? "s" : ""}
              </span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
