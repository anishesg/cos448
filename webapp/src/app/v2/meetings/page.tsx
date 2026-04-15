"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  MapPin,
  Video,
  ChevronDown,
  Sparkles,
  Users,
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { V2Card, V2CardContent } from "@/components/v2/ui/v2-card";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { PageTransition } from "@/components/v2/motion-wrapper";

interface MeetingEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  meetLink?: string;
  location?: string;
  brief?: { markdown: string; generatedAt: string };
}

export default function V2MeetingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ events: MeetingEvent[] }>({
    queryKey: ["meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings/briefs");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const briefMutation = useMutation({
    mutationFn: async (event: MeetingEvent) => {
      const res = await fetch("/api/meetings/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          title: event.title,
          attendees: event.attendees,
          start: event.start,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });

  const events = data?.events ?? [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#a855f7] shadow-[0_0_20px_rgba(0,212,255,0.18)]">
            <CalendarDays
              className="h-[18px] w-[18px] text-[#08080f]"
              strokeWidth={2.2}
            />
          </div>
          <h1 className="v2-text-gradient text-[24px] font-bold tracking-[-0.02em]">
            Today&apos;s Meetings
          </h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <V2Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] py-24 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
            <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-56 -translate-x-1/2 rounded-full bg-gradient-to-b from-[rgba(0,212,255,0.14)] via-[rgba(168,85,247,0.08)] to-transparent blur-3xl" />
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00d4ff] to-[#a855f7] shadow-[0_0_24px_rgba(0,212,255,0.2)]">
              <CalendarDays
                className="h-7 w-7 text-[#08080f]"
                strokeWidth={2}
              />
            </div>
            <h2 className="v2-text-gradient relative mt-5 text-[18px] font-bold tracking-[-0.02em]">
              No meetings today
            </h2>
            <p className="relative mt-2 max-w-sm px-6 text-[14px] text-[var(--v2-text-secondary)]">
              No meetings scheduled for today.
            </p>
          </div>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute bottom-0 left-[52px] top-0 w-px bg-[rgba(255,255,255,0.08)]" />

            {events.map((event, idx) => (
              <MeetingRow
                key={event.id}
                event={event}
                onGenerateBrief={() => briefMutation.mutate(event)}
                briefPending={briefMutation.isPending}
                isLast={idx === events.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function MeetingRow({
  event,
  onGenerateBrief,
  briefPending,
  isLast,
}: {
  event: MeetingEvent;
  onGenerateBrief: () => void;
  briefPending: boolean;
  isLast: boolean;
}) {
  const [briefOpen, setBriefOpen] = useState(false);
  const start = new Date(event.start);
  const end = new Date(event.end);
  const now = new Date();
  const minsUntil = differenceInMinutes(start, now);
  const isSoon = minsUntil > 0 && minsUntil <= 30;

  return (
    <div className={cn("relative flex gap-4 pb-8", isLast && "pb-0")}>
      <div className="w-[40px] shrink-0 pt-4 text-right">
        <p className="text-[13px] font-medium tabular-nums text-[var(--v2-text-secondary)]">
          {format(start, "h:mm")}
        </p>
        <p className="text-[10px] text-[var(--v2-text-tertiary)]">
          {format(start, "a")}
        </p>
      </div>

      <div className="relative z-10 mt-[18px] flex h-4 w-4 shrink-0 items-center justify-center">
        <span
          className={cn(
            "block h-2.5 w-2.5 rounded-full",
            isSoon
              ? "bg-[#00e87b] shadow-[0_0_12px_rgba(0,232,123,0.75),0_0_4px_rgba(0,232,123,0.9)]"
              : "bg-[var(--v2-text-ghost)] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]",
          )}
        />
      </div>

      <V2Card className="flex-1">
        <V2CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[var(--v2-text-primary)]">
                {event.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--v2-text-secondary)]">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(start, "h:mm a")} – {format(end, "h:mm a")}
                </span>
                {isSoon && (
                  <V2Badge color="green" dot>
                    In {minsUntil}m
                  </V2Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {event.meetLink && (
                <a
                  href={event.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <V2Button variant="outline" size="sm" color="green">
                    <Video className="h-3 w-3" />
                    Join
                  </V2Button>
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--v2-text-secondary)]">
            {event.attendees.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {event.attendees.slice(0, 3).join(", ")}
                {event.attendees.length > 3 &&
                  ` +${event.attendees.length - 3}`}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
            )}
          </div>

          {event.brief ? (
            <div>
              <button
                type="button"
                onClick={() => setBriefOpen(!briefOpen)}
                className="flex items-center gap-1.5 rounded-[10px] text-[11px] font-medium text-[#a855f7] transition-colors hover:text-[#c084fc]"
              >
                <Sparkles className="h-3 w-3" />
                AI Prep Brief
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    !briefOpen && "-rotate-90",
                  )}
                />
              </button>
              {briefOpen && (
                <div
                  className="mt-2 rounded-2xl border border-[rgba(168,85,247,0.15)] bg-[rgba(255,255,255,0.025)] p-4 text-[12px] leading-relaxed text-[var(--v2-text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
                  dangerouslySetInnerHTML={{
                    __html: event.brief.markdown.replace(/\n/g, "<br/>"),
                  }}
                />
              )}
            </div>
          ) : (
            <V2Button
              variant="ghost"
              size="sm"
              color="purple"
              onClick={onGenerateBrief}
              disabled={briefPending}
            >
              <Sparkles className="h-3 w-3" />
              {briefPending ? "Generating..." : "Prep Brief"}
            </V2Button>
          )}
        </V2CardContent>
      </V2Card>
    </div>
  );
}
