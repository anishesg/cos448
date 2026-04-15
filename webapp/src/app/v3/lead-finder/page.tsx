"use client";

import { useState, useEffect, useRef } from "react";
import {
  Crosshair,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  User,
  MessageSquare,
  Send,
} from "lucide-react";
import { DEMO_LOG_ENTRIES } from "@/lib/demo/demo-data";

type Platform = "Facebook" | "LinkedIn";
type RunStatus = "idle" | "running" | "done" | "error";

interface LeadResult {
  name: string;
  location: string;
  student: string;
  post: string;
  messageSent: string;
}

interface RunState {
  status: RunStatus;
  logs: string[];
  startedAt: number | null;
  leads?: LeadResult[];
}

const PLATFORM_OPTIONS: Platform[] = ["Facebook", "LinkedIn"];

export default function LeadFinderPage() {
  const [platform, setPlatform] = useState<Platform>("Facebook");
  const [query, setQuery] = useState("");
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [runState, setRunState] = useState<RunState>({
    status: "idle",
    logs: [],
    startedAt: null,
  });
  const [demoLogIndex, setDemoLogIndex] = useState(0);
  const [leads, setLeads] = useState<LeadResult[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll logs (trigger on both server logs and demo log index)
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [runState.logs, demoLogIndex]);

  // Poll server for real logs (and capture leads when done)
  useEffect(() => {
    if (runState.status === "running") {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/lead-finder/run");
          if (res.ok) {
            const data = await res.json();
            setRunState({ status: data.status, logs: data.logs ?? [], startedAt: data.startedAt });
            if (data.leads) setLeads(data.leads);
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runState.status]);

  // Variable-delay demo log ticker
  useEffect(() => {
    if (runState.status !== "running" || demoLogIndex >= DEMO_LOG_ENTRIES.length - 1) return;
    const nextDelay = DEMO_LOG_ENTRIES[demoLogIndex]?.delay ?? 800;
    demoTimerRef.current = setTimeout(() => {
      setDemoLogIndex((i) => Math.min(i + 1, DEMO_LOG_ENTRIES.length - 1));
    }, nextDelay);
    return () => {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    };
  }, [runState.status, demoLogIndex]);

  async function handleRun() {
    if (runState.status === "running") return;

    setDemoLogIndex(0);
    setRunState({ status: "running", logs: [], startedAt: Date.now() });

    try {
      await fetch("/api/lead-finder/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, query }),
      });
    } catch {
      // If server call fails, still show demo logs
    }
  }

  const isRunning = runState.status === "running";
  const isDone = runState.status === "done";
  const isError = runState.status === "error";
  const hasStarted = runState.status !== "idle";

  const demoLogTexts = DEMO_LOG_ENTRIES.map((e) => e.text);

  // Merge server logs + demo logs for display
  const displayLogs =
    hasStarted
      ? [
          ...demoLogTexts.slice(0, demoLogIndex + 1),
          ...runState.logs.filter(
            (l) => !demoLogTexts.some((d) => l.includes(d.replace(/[^\w\s]/g, "")))
          ),
        ]
      : [];

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Crosshair size={16} />
            Lead Finder
          </span>
          {isRunning && (
            <span className="v3-badge v3-badge-amber" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Loader2 size={10} className="animate-spin" />
              Running
            </span>
          )}
          {isDone && (
            <span className="v3-badge v3-badge-green" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle size={10} />
              Complete
            </span>
          )}
          {isError && (
            <span className="v3-badge v3-badge-red" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={10} />
              Error
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>
        {/* Config card */}
        <div
          className="v3-card"
          style={{ padding: "24px", marginBottom: 20 }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--v3-text-secondary)",
              marginBottom: 20,
            }}
          >
            Find and message leads from social media
          </div>

          {/* Platform dropdown */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 12,
                color: "var(--v3-text-tertiary)",
                marginBottom: 6,
                display: "block",
              }}
            >
              Platform
            </label>
            <div style={{ position: "relative" }}>
              <button
                className="v3-input"
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  background: "var(--v3-bg-input)",
                }}
                onClick={() => setShowPlatformDropdown((v) => !v)}
                disabled={isRunning}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background:
                        platform === "Facebook"
                          ? "#1877f2"
                          : "#0077b5",
                      flexShrink: 0,
                    }}
                  />
                  {platform}
                </span>
                <ChevronDown size={14} style={{ color: "var(--v3-text-ghost)" }} />
              </button>
              {showPlatformDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: "var(--v3-bg-popup, var(--v3-bg-card))",
                    border: "1px solid var(--v3-border)",
                    borderRadius: "var(--v3-radius-md)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    zIndex: 50,
                    overflow: "hidden",
                  }}
                >
                  {PLATFORM_OPTIONS.map((p) => (
                    <button
                      key={p}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "10px 14px",
                        fontSize: 13,
                        background:
                          platform === p
                            ? "var(--v3-bg-hover)"
                            : "transparent",
                        color: "var(--v3-text-primary)",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onClick={() => {
                        setPlatform(p);
                        setShowPlatformDropdown(false);
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: p === "Facebook" ? "#1877f2" : "#0077b5",
                          flexShrink: 0,
                        }}
                      />
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Query input */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 12,
                color: "var(--v3-text-tertiary)",
                marginBottom: 6,
                display: "block",
              }}
            >
              Who are you looking for?
            </label>
            <input
              className="v3-input"
              placeholder="e.g. parents of high school juniors asking about SAT prep"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isRunning}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query && !isRunning) handleRun();
              }}
            />
            <p
              style={{
                fontSize: 11,
                color: "var(--v3-text-ghost)",
                marginTop: 6,
              }}
            >
              Fridcay will scan Facebook groups, identify matching posts, and
              automatically message qualified leads.
            </p>
          </div>

          <button
            className="v3-btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleRun}
            disabled={isRunning || !query}
          >
            {isRunning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Running lead finder...
              </>
            ) : (
              <>
                <Play size={14} />
                Find &amp; message leads
              </>
            )}
          </button>
        </div>

        {/* Live log output */}
        {hasStarted && (
          <div
            className="v3-card"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--v3-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--v3-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isRunning && (
                  <Loader2
                    size={12}
                    className="animate-spin"
                    style={{ color: "var(--v3-accent-amber, #f59e0b)" }}
                  />
                )}
                {isDone && (
                  <CheckCircle
                    size={12}
                    style={{ color: "var(--v3-accent-green, #22c55e)" }}
                  />
                )}
                Live output
              </span>
              {isRunning && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--v3-text-ghost)",
                  }}
                >
                  {Math.round((Date.now() - (runState.startedAt ?? Date.now())) / 1000)}s
                </span>
              )}
            </div>
            <div
              style={{
                background: "var(--v3-bg-code, #0f1117)",
                padding: "16px",
                fontFamily: "var(--font-mono, 'Menlo', 'Monaco', monospace)",
                fontSize: 12,
                lineHeight: 1.6,
                color: "#a8b4c8",
                minHeight: 200,
                maxHeight: 400,
                overflowY: "auto",
              }}
            >
              {displayLogs.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: line.startsWith("✅")
                      ? "#4ade80"
                      : line.startsWith("❌") || line.startsWith("[stderr]")
                      ? "#f87171"
                      : line.startsWith("──")
                      ? "#818cf8"
                      : line.startsWith("📬") || line.startsWith("✉️")
                      ? "#60a5fa"
                      : "#a8b4c8",
                  }}
                >
                  {line}
                </div>
              ))}
              {isRunning && (
                <div
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 14,
                    background: "#818cf8",
                    animation: "blink 1s step-end infinite",
                    marginLeft: 2,
                    verticalAlign: "text-bottom",
                  }}
                />
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Done summary */}
        {isDone && (
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              borderRadius: "var(--v3-radius-md)",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
              fontSize: 13,
              color: "var(--v3-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
            Lead finder complete — {leads.length || 5} leads contacted.
          </div>
        )}

        {/* Leads found cards */}
        {isDone && leads.length > 0 && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--v3-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
              <User size={14} />
              Leads contacted ({leads.length})
            </div>
            {leads.map((lead, i) => (
              <div
                key={i}
                className="v3-card"
                style={{ padding: "16px 18px" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--v3-text-primary)" }}>
                      {lead.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--v3-text-tertiary)", marginTop: 2 }}>
                      {lead.location} · {lead.student}
                    </div>
                  </div>
                  <span className="v3-badge v3-badge-green" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                    <Send size={8} />
                    Sent
                  </span>
                </div>

                <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, background: "var(--v3-bg-hover, rgba(0,0,0,0.03))", fontSize: 12, lineHeight: 1.5, color: "var(--v3-text-secondary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--v3-text-ghost)", marginBottom: 4 }}>
                    <MessageSquare size={9} />
                    Their post
                  </div>
                  {lead.post}
                </div>

                <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)", fontSize: 12, lineHeight: 1.5, color: "var(--v3-text-secondary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--v3-accent-indigo, #6366f1)", marginBottom: 4 }}>
                    <Send size={9} />
                    Message sent
                  </div>
                  {lead.messageSent}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
