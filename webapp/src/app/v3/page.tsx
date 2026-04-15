"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import {
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  CheckSquare,
  Plus,
  RefreshCw,
  Paperclip,
  HelpCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface MeetingEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: { email: string }[];
}

function useSession() {
  return useQuery<{ user: { name: string | null; email: string } | null }>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) return { user: null };
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

function useWatchtowerAlerts() {
  return useQuery<{ alerts: Array<{ id: string; type: string; title: string; threadId?: string }> }>({
    queryKey: ["watchtower"],
    queryFn: async () => {
      const res = await fetch("/api/watchtower");
      if (!res.ok) return { alerts: [] };
      return res.json();
    },
  });
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

function useSyncEmails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const syncRes = await fetch("/api/emails/sync", { method: "POST" });
      if (!syncRes.ok) throw new Error("Sync failed");
      await fetch("/api/sync/full", { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["watchtower"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

function useAiCommand() {
  return useMutation<{ response: string }, Error, string>({
    mutationFn: async (query: string) => {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "AI request failed");
      }
      return res.json();
    },
  });
}

export default function V3HomePage() {
  const router = useRouter();
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: sessionData } = useSession();
  const { data: meetingsData } = useMeetings();
  const { data: alertsData } = useWatchtowerAlerts();
  const syncMutation = useSyncEmails();
  const aiMutation = useAiCommand();

  const handleSendAi = async () => {
    const query = aiQuery.trim();
    if (!query || aiMutation.isPending) return;
    setAiResponse(null);
    setAiError(null);
    setAiQuery("");
    try {
      const result = await aiMutation.mutateAsync(query);
      setAiResponse(result.response);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendAi();
    }
  };

  const today = new Date();

  const events = meetingsData?.events ?? [];
  const alerts = alertsData?.alerts ?? [];

  const userName = sessionData?.user?.name?.split(" ")[0] || "there";

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div>
      {/* Page header */}
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">Home</span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-topbar-btn-icon" title="Help">
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        {/* Greeting */}
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24, letterSpacing: "-0.02em", color: "var(--v3-text-primary)" }}>
          {getGreeting()}, {userName}.
        </h1>

        {/* AI Chat */}
        <div className="v3-ai-chat" style={{ marginBottom: 32 }}>
          <textarea
            ref={textareaRef}
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (⌘↵ to send)"
            rows={3}
            disabled={aiMutation.isPending}
          />
          <div className="v3-ai-chat-footer">
            <span style={{ fontSize: 12, color: "var(--v3-text-ghost)", marginRight: "auto" }}>
              Auto
            </span>
            <button className="v3-topbar-btn-icon" style={{ width: 24, height: 24 }} disabled={aiMutation.isPending}>
              <Paperclip size={12} />
            </button>
            <button
              className="v3-btn-primary"
              style={{ padding: "5px 12px", fontSize: 12, opacity: aiMutation.isPending || !aiQuery.trim() ? 0.6 : 1 }}
              onClick={handleSendAi}
              disabled={aiMutation.isPending || !aiQuery.trim()}
            >
              {aiMutation.isPending ? (
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Send size={12} />
              )}
              {aiMutation.isPending ? "Thinking..." : "Send"}
            </button>
          </div>

          {/* AI response */}
          {(aiResponse || aiError) && (
            <div
              style={{
                marginTop: 12,
                padding: "14px 16px",
                borderRadius: "var(--v3-radius-md)",
                border: `1px solid ${aiError ? "rgba(239,68,68,0.25)" : "var(--v3-border)"}`,
                background: aiError ? "rgba(239,68,68,0.04)" : "var(--v3-bg-surface)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {aiError ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--v3-accent-red, #ef4444)" }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{aiError}</span>
                </div>
              ) : (
                <div style={{ color: "var(--v3-text-primary)", whiteSpace: "pre-wrap" }}>
                  {aiResponse}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Meetings section */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 500 }}>Meetings</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--v3-text-secondary)" }}>
                Today, {today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button className="v3-topbar-btn-icon" style={{ width: 24, height: 24 }}>
                <ChevronLeft size={14} />
              </button>
              <button className="v3-topbar-btn-icon" style={{ width: 24, height: 24 }}>
                <ChevronRight size={14} />
              </button>
              <button className="v3-topbar-btn-icon" style={{ width: 24, height: 24 }}>
                <MoreHorizontal size={14} />
              </button>
            </div>
          </div>

          {events.length === 0 ? (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                borderRadius: "var(--v3-radius-lg)",
                border: "1px solid var(--v3-border)",
                background: "var(--v3-bg-surface)",
              }}
            >
              {syncMutation.isPending ? (
                <div style={{ color: "var(--v3-text-tertiary)", fontSize: 13 }}>
                  <RefreshCw
                    size={16}
                    style={{ animation: "spin 1s linear infinite", marginBottom: 8 }}
                  />
                  <p>Syncing your calendar events...</p>
                </div>
              ) : (
                <>
                  <Calendar
                    size={32}
                    style={{ opacity: 0.15, marginBottom: 12, margin: "0 auto 12px" }}
                  />
                  <p style={{ color: "var(--v3-text-tertiary)", fontSize: 13, marginBottom: 4 }}>
                    No meetings
                  </p>
                  <p style={{ color: "var(--v3-text-ghost)", fontSize: 12 }}>
                    Pick a different date to plan ahead or review past meetings.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {events.map((event) => (
                <div
                  key={event.id}
                  className="v3-card v3-card-tint-blue"
                  style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                  onClick={() => window.location.href = "/v3/meetings"}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{event.summary}</div>
                    <div style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginTop: 2 }}>
                      {new Date(event.start.dateTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" – "}
                      {new Date(event.end.dateTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: "var(--v3-text-ghost)" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks section */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 500 }}>
              Tasks <span style={{ color: "var(--v3-text-ghost)", fontWeight: 400 }}>{alerts.length}</span>
            </h2>
            <span
              style={{ fontSize: 12, color: "var(--v3-text-link)", cursor: "pointer" }}
              onClick={() => router.push("/v3/tasks")}
            >
              View all
            </span>
          </div>

          {alerts.length === 0 ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                borderRadius: "var(--v3-radius-lg)",
                border: "1px solid var(--v3-border)",
                background: "var(--v3-bg-surface)",
              }}
            >
              <p style={{ color: "var(--v3-text-tertiary)", fontSize: 13, marginBottom: 4 }}>
                Stay on top of work
              </p>
              <p style={{ color: "var(--v3-text-ghost)", fontSize: 12, marginBottom: 16 }}>
                Create tasks for yourself or your team to track next steps.
              </p>
              <button
                className="v3-btn-secondary"
                onClick={() => router.push("/v3/tasks")}
              >
                <Plus size={14} />
                New task
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: "var(--v3-radius-sm)",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                  }}
                  className="v3-task-row"
                  onClick={() => alert.threadId && router.push(`/v3/threads/${alert.threadId}`)}
                >
                  <CheckSquare
                    size={16}
                    style={{ color: "var(--v3-text-ghost)", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, flex: 1 }}>{alert.title}</span>
                  <span
                    className={`v3-badge ${
                      alert.type === "lead_cooling"
                        ? "v3-badge-amber"
                        : alert.type === "client_waiting"
                        ? "v3-badge-red"
                        : "v3-badge-default"
                    }`}
                  >
                    {alert.type.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
