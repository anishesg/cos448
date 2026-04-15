"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Sparkles, Clock, Users, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface MeetingEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: { email: string; displayName?: string }[];
  brief?: { id: string; briefContent: Record<string, unknown> };
}

function useMeetings() {
  return useQuery<{ events: MeetingEvent[] }>({
    queryKey: ["meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meetings/briefs");
      if (!res.ok) return { events: [] };
      return res.json();
    },
  });
}

function useGenerateBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch("/api/meetings/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarEventId: eventId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });
}

export default function V3MeetingsPage() {
  const { data, isLoading } = useMeetings();
  const generateBrief = useGenerateBrief();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const events = data?.events ?? [];

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Calendar size={16} />
            Meetings
          </span>
          <span className="v3-badge v3-badge-default">{events.length} today</span>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>Loading...</div>
        ) : events.length === 0 ? (
          <div className="v3-empty-state">
            <Calendar size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>No meetings today</h3>
            <p>Calendar events will appear here with AI-powered briefing prep.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {events.map((event) => (
              <div key={event.id} className="v3-card" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 20px",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                >
                  <Calendar size={16} style={{ color: "var(--v3-accent-indigo)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{event.summary}</div>
                    <div style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                      <Clock size={12} />
                      {new Date(event.start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {" - "}
                      {new Date(event.end.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {event.attendees && event.attendees.length > 0 && (
                        <>
                          <Users size={12} />
                          {event.attendees.length} attendees
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="v3-btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateBrief.mutate(event.id);
                    }}
                    disabled={generateBrief.isPending}
                    style={{ fontSize: 12 }}
                  >
                    <Sparkles size={12} />
                    {generateBrief.isPending ? "..." : "Brief"}
                  </button>
                  {expandedId === event.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>

                {expandedId === event.id && (
                  <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--v3-border)" }}>
                    {event.brief ? (
                      <div style={{ padding: "12px 0", fontSize: 13, lineHeight: 1.7, color: "var(--v3-text-secondary)", whiteSpace: "pre-wrap" }}>
                        {typeof event.brief.briefContent === "string"
                          ? event.brief.briefContent
                          : JSON.stringify(event.brief.briefContent, null, 2)}
                      </div>
                    ) : (
                      <div style={{ padding: "16px 0", textAlign: "center", color: "var(--v3-text-ghost)", fontSize: 13 }}>
                        No brief generated yet. Click &ldquo;Brief&rdquo; to generate.
                      </div>
                    )}
                    {event.attendees && event.attendees.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--v3-text-tertiary)", marginBottom: 6 }}>Attendees</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {event.attendees.map((a, i) => (
                            <span key={i} className="v3-badge v3-badge-default">
                              {a.displayName || a.email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
