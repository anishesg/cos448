"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  TestTube,
  Play,
  User,
  Loader2,
  CheckCircle,
  MessageSquare,
} from "lucide-react";

interface Persona {
  id: string;
  name: string;
  role: string;
  company: string;
  scenario: string;
  personality: string;
}

function usePersonas() {
  return useQuery<{ personas: Persona[] }>({
    queryKey: ["test-personas"],
    queryFn: async () => {
      const res = await fetch("/api/test/simulate");
      if (!res.ok) return { personas: [] };
      return res.json();
    },
  });
}

function useSimulate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (personaId: string) => {
      const res = await fetch("/api/test/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
  });
}

export default function V3TestPage() {
  const { data, isLoading } = usePersonas();
  const simulateMutation = useSimulate();
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const personas = data?.personas ?? [];

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <TestTube size={16} />
            Test Lab
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        <p style={{ fontSize: 13, color: "var(--v3-text-tertiary)", marginBottom: 24 }}>
          Simulate customer interactions to test how the AI handles different scenarios.
        </p>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>Loading personas...</div>
        ) : personas.length === 0 ? (
          <div className="v3-empty-state">
            <TestTube size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>Test Lab</h3>
            <p>No test personas available.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {personas.map((p) => (
              <div
                key={p.id}
                className="v3-card"
                style={{
                  cursor: "pointer",
                  borderColor: selectedPersona === p.id ? "var(--v3-accent-indigo)" : undefined,
                  transition: "border-color 0.15s ease",
                }}
                onClick={() => setSelectedPersona(p.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div className="v3-avatar v3-avatar-sm" style={{ background: "var(--v3-accent-purple)" }}>
                    {p.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>
                      {p.role} at {p.company}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "var(--v3-text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>
                  {p.scenario}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="v3-badge v3-badge-default">{p.personality}</span>
                  {selectedPersona === p.id && (
                    <button
                      className="v3-btn-primary"
                      style={{ marginLeft: "auto", fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        simulateMutation.mutate(p.id);
                      }}
                      disabled={simulateMutation.isPending}
                    >
                      {simulateMutation.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      {simulateMutation.isPending ? "Sending..." : "Simulate"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {simulateMutation.isSuccess && (
          <div
            style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: "var(--v3-radius-md)",
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <CheckCircle size={14} style={{ color: "var(--v3-accent-green)" }} />
            Simulation sent! Check your threads to see the incoming message.
          </div>
        )}
      </div>
    </div>
  );
}
