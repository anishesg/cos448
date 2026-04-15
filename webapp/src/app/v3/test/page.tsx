"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TestTube,
  Play,
  Loader2,
  CheckCircle,
  ExternalLink,
  User,
} from "lucide-react";

interface Persona {
  key: string;
  name: string;
  email: string;
  backstory: string;
}

interface SimulateResult {
  success: boolean;
  persona: string;
  email: string;
  subject: string;
  threadId: string;
  message: string;
}

function usePersonas() {
  return useQuery<{ personas: Persona[] }>({
    queryKey: ["test-personas"],
    queryFn: async () => {
      const res = await fetch("/api/test/simulate");
      if (!res.ok) return { personas: [] };
      return res.json();
    },
    staleTime: Infinity,
  });
}

function useSimulate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (personaKey: string): Promise<SimulateResult> => {
      const res = await fetch("/api/test/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Simulation failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["watchtower"] });
    },
  });
}

const personaColors: Record<string, string> = {
  "kapil.kataria": "var(--v3-accent-indigo)",
  "vikram.kakaria": "var(--v3-accent-orange)",
  "sanketh.kamath": "var(--v3-accent-green)",
};

export default function V3TestPage() {
  const router = useRouter();
  const { data, isLoading } = usePersonas();
  const simulateMutation = useSimulate();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const personas = data?.personas ?? [];

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <TestTube size={16} />
            Test Lab
          </span>
          <span className="v3-badge v3-badge-purple">Simulated clients</span>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px" }}>
        <div
          style={{
            padding: "14px 20px",
            borderRadius: "var(--v3-radius-lg)",
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.15)",
            marginBottom: 28,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--v3-text-secondary)",
          }}
        >
          <strong style={{ color: "var(--v3-text-primary)" }}>How it works:</strong> Choose a
          persona to inject a simulated inbound email from a fake client. Then open the thread
          and click <strong>Automate</strong> to start the full back-and-forth loop. The AI
          plays both sides — it replies as the client and drafts responses as your business.
          In production, turns continue automatically via background workers.
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>
            <Loader2 size={20} className="animate-spin" style={{ margin: "0 auto 12px", display: "block" }} />
            Loading personas...
          </div>
        ) : personas.length === 0 ? (
          <div className="v3-empty-state">
            <TestTube size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>No personas available</h3>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {personas.map((p) => {
              const color = personaColors[p.key] || "var(--v3-accent-purple)";
              const isSelected = selectedKey === p.key;
              return (
                <div
                  key={p.key}
                  className="v3-card"
                  style={{
                    cursor: "pointer",
                    borderColor: isSelected ? "var(--v3-accent-indigo)" : undefined,
                    transition: "border-color 0.15s ease",
                    padding: "16px 20px",
                  }}
                  onClick={() => setSelectedKey(isSelected ? null : p.key)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div
                      className="v3-avatar v3-avatar-sm"
                      style={{ background: color, flexShrink: 0 }}
                    >
                      {p.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--v3-text-primary)" }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--v3-text-ghost)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.email}
                      </div>
                    </div>
                    <User size={13} style={{ color: "var(--v3-text-ghost)", flexShrink: 0 }} />
                  </div>

                  <p style={{ fontSize: 12, color: "var(--v3-text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                    {p.backstory}
                  </p>

                  {isSelected && (
                    <button
                      className="v3-btn-primary"
                      style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        simulateMutation.mutate(p.key);
                      }}
                      disabled={simulateMutation.isPending}
                    >
                      {simulateMutation.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      {simulateMutation.isPending ? "Injecting email..." : "Inject inbound email"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {simulateMutation.isSuccess && simulateMutation.data && (
          <div
            style={{
              marginTop: 20,
              padding: "16px 20px",
              borderRadius: "var(--v3-radius-lg)",
              background: "rgba(34, 197, 94, 0.07)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <CheckCircle size={14} style={{ color: "var(--v3-accent-green)" }} />
              <strong style={{ color: "var(--v3-text-primary)" }}>
                Email injected from {simulateMutation.data.persona}
              </strong>
            </div>
            <p style={{ color: "var(--v3-text-secondary)", marginBottom: 12 }}>
              Subject: <em>{simulateMutation.data.subject}</em>
            </p>
            <button
              className="v3-btn-secondary"
              style={{ fontSize: 12 }}
              onClick={() => router.push(`/v3/threads/${simulateMutation.data!.threadId}`)}
            >
              <ExternalLink size={12} />
              Open thread &amp; click Automate
            </button>
          </div>
        )}

        {simulateMutation.isError && (
          <div
            style={{
              marginTop: 20,
              padding: "14px 20px",
              borderRadius: "var(--v3-radius-lg)",
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
              fontSize: 13,
              color: "var(--v3-accent-red)",
            }}
          >
            {simulateMutation.error?.message ?? "Simulation failed. Check that you have Gmail connected."}
          </div>
        )}
      </div>
    </div>
  );
}
