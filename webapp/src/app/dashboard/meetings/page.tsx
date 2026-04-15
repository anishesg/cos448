"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  CalendarDays,
  Clock,
  Video,
  MapPin,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  meetLink: string | null;
  location: string | null;
  brief: { markdown: string } | null;
}

function useMeetings() {
  return useQuery<{ events: CalendarEvent[] }>({
    queryKey: ["meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings/briefs");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

function useGenerateBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: CalendarEvent) => {
      const res = await fetch("/api/meetings/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          eventTitle: event.title,
          eventTime: event.start,
          duration: event.end
            ? `${differenceInMinutes(parseISO(event.end), parseISO(event.start))} min`
            : "30 min",
          attendees: event.attendees,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

function MeetingCard({ event }: { event: CalendarEvent }) {
  const [briefOpen, setBriefOpen] = useState(!!event.brief);
  const generateBrief = useGenerateBrief();
  const start = parseISO(event.start);
  const minutesUntil = differenceInMinutes(start, new Date());
  const isSoon = minutesUntil > 0 && minutesUntil <= 30;

  return (
    <Card
      className={`border-stone-200 shadow-none ${isSoon ? "border-l-2 border-l-indigo-500" : ""}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-stone-900">
              {event.title}
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-stone-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(start, "h:mm a")}
              </span>
              {isSoon && (
                <Badge className="bg-indigo-50 text-indigo-700 text-[10px]">
                  In {minutesUntil} min
                </Badge>
              )}
              {event.meetLink && (
                <a
                  href={event.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-600 hover:underline"
                >
                  <Video className="h-3 w-3" />
                  Join
                </a>
              )}
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </span>
              )}
            </div>
          </div>

          {!event.brief && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateBrief.mutate(event)}
              disabled={generateBrief.isPending}
              className="text-xs gap-1 h-7 shrink-0"
            >
              <Sparkles
                className={`h-3 w-3 ${generateBrief.isPending ? "animate-pulse" : ""}`}
              />
              {generateBrief.isPending ? "Generating..." : "Prep Brief"}
            </Button>
          )}
        </div>

        {event.attendees.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.attendees.map((email) => (
              <Badge key={email} variant="secondary" className="text-[10px]">
                {email}
              </Badge>
            ))}
          </div>
        )}

        {event.brief?.markdown && (
          <Collapsible open={briefOpen} onOpenChange={setBriefOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
              <ChevronDown
                className={`h-3 w-3 transition-transform ${briefOpen ? "" : "-rotate-90"}`}
              />
              {briefOpen ? "Hide brief" : "Show prep brief"}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 prose prose-sm prose-stone max-w-none text-xs leading-relaxed">
                <div
                  dangerouslySetInnerHTML={{
                    __html: event.brief.markdown.replace(/\n/g, "<br/>"),
                  }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export default function MeetingsPage() {
  const { data, isLoading } = useMeetings();
  const events = data?.events ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-stone-900">
          Today&apos;s Meetings
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-16 text-center space-y-2">
            <CalendarDays className="h-8 w-8 text-stone-300 mx-auto" />
            <p className="text-sm text-stone-500">
              No meetings scheduled for today.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <MeetingCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
