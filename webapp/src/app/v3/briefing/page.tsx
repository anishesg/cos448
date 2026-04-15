"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Sun, Moon, Loader2, Plus, Clock } from "lucide-react";

interface Briefing {
  id: string;
  type: string;
  content: Record<string, unknown>;
  generatedAt: string;
}

function useBriefings() {
  return useQuery<{ briefings: Briefing[] }>({
    queryKey: ["briefings"],
    queryFn: async () => {
      const res = await fetch("/api/briefings");
      if (!res.ok) return { briefings: [] };
      return res.json();
    },
  });
}

function useGenerateBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (type: string) => {
      const res = await fetch("/api/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefings"] }),
  });
}

export default function V3BriefingPage() {
  const { data, isLoading } = useBriefings();
  const generateMutation = useGenerateBriefing();
  const briefings = data?.briefings ?? [];

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <BookOpen size={16} />
            Briefings
          </span>
        </div>
        <div className="v3-page-header-right">
          <button
            className="v3-btn-secondary"
            onClick={() => generateMutation.mutate("morning")}
            disabled={generateMutation.isPending}
            style={{ fontSize: 12 }}
          >
            <Sun size={14} />
            {generateMutation.isPending ? "Generating..." : "Morning Briefing"}
          </button>
          <button
            className="v3-btn-primary"
            onClick={() => generateMutation.mutate("evening")}
            disabled={generateMutation.isPending}
            style={{ fontSize: 12 }}
          >
            <Moon size={14} />
            Evening Briefing
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>Loading...</div>
        ) : briefings.length === 0 ? (
          <div className="v3-empty-state">
            <BookOpen size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>No briefings yet</h3>
            <p>Generate a morning or evening briefing to get AI-powered insights about your business.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {briefings.map((b) => (
              <div key={b.id} className="v3-card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  {b.type === "morning" ? (
                    <Sun size={16} style={{ color: "var(--v3-accent-amber)" }} />
                  ) : (
                    <Moon size={16} style={{ color: "var(--v3-accent-indigo)" }} />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 500, textTransform: "capitalize" }}>
                    {b.type} Briefing
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--v3-text-ghost)" }}>
                    <Clock size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                    {new Date(b.generatedAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--v3-text-secondary)", whiteSpace: "pre-wrap" }}>
                  {typeof b.content === "string" ? b.content : JSON.stringify(b.content, null, 2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
