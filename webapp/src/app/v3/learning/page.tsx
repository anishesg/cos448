"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  CheckCircle,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
} from "lucide-react";

interface Preference {
  id: string;
  observation: string;
  evidence: Record<string, unknown>;
  confidence: string;
  status: string;
  appliesTo: string;
  createdAt: string;
}

function usePreferences() {
  return useQuery<{ preferences: Preference[] }>({
    queryKey: ["learning"],
    queryFn: async () => {
      const res = await fetch("/api/learning");
      if (!res.ok) return { preferences: [] };
      return res.json();
    },
  });
}

function useAnalyze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/learning", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning"] }),
  });
}

function useUpdatePreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const action = status === "confirmed" ? "confirm" : "reject";
      const res = await fetch("/api/learning", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferenceId: id, action }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning"] }),
  });
}

export default function V3LearningPage() {
  const { data, isLoading, isError } = usePreferences();
  const analyzeMutation = useAnalyze();
  const updateMutation = useUpdatePreference();
  const preferences = data?.preferences ?? [];

  const suggested = preferences.filter((p) => p.status === "suggested");
  const confirmed = preferences.filter((p) => p.status === "confirmed");

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Sparkles size={16} />
            Learning
          </span>
          <span className="v3-badge v3-badge-default">{preferences.length}</span>
        </div>
        <div className="v3-page-header-right">
          <button
            className="v3-btn-primary"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {analyzeMutation.isPending ? "Analyzing..." : "Analyze Behavior"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>Loading...</div>
        ) : isError ? (
          <div className="v3-empty-state">
            <Sparkles size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>Failed to load preferences</h3>
            <p>Something went wrong. Please try refreshing.</p>
          </div>
        ) : preferences.length === 0 ? (
          <div className="v3-empty-state">
            <Sparkles size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>No learned preferences</h3>
            <p>Run behavior analysis to discover patterns in how you communicate.</p>
          </div>
        ) : (
          <>
            {suggested.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--v3-text-tertiary)" }}>
                  Suggested <span className="v3-badge v3-badge-amber">{suggested.length}</span>
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {suggested.map((p) => (
                    <div key={p.id} className="v3-card" style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>{p.observation}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                            <span className="v3-badge v3-badge-default">{p.appliesTo}</span>
                            <span style={{ color: "var(--v3-text-ghost)" }}>
                              Confidence: {(Number(p.confidence) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button
                            className="v3-topbar-btn-icon"
                            style={{ color: "var(--v3-accent-green)" }}
                            onClick={() => updateMutation.mutate({ id: p.id, status: "confirmed" })}
                            title="Confirm"
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            className="v3-topbar-btn-icon"
                            style={{ color: "var(--v3-accent-red)" }}
                            onClick={() => updateMutation.mutate({ id: p.id, status: "rejected" })}
                            title="Reject"
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {confirmed.length > 0 && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--v3-text-tertiary)" }}>
                  Confirmed <span className="v3-badge v3-badge-green">{confirmed.length}</span>
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {confirmed.map((p) => (
                    <div key={p.id} className="v3-card" style={{ padding: "14px 20px", borderColor: "rgba(34, 197, 94, 0.15)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CheckCircle size={14} style={{ color: "var(--v3-accent-green)", flexShrink: 0 }} />
                        <p style={{ fontSize: 13, flex: 1 }}>{p.observation}</p>
                        <span className="v3-badge v3-badge-default">{p.appliesTo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
