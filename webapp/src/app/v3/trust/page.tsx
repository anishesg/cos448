"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface TrustRule {
  id: string;
  category: string;
  autonomyLevel: string;
}

const autonomyLevels = [
  { value: "full_auto", label: "Full Auto", description: "AI handles completely" },
  { value: "auto_with_notify", label: "Auto + Notify", description: "AI handles, notifies you" },
  { value: "draft_for_review", label: "Draft for Review", description: "AI drafts, you approve" },
  { value: "suggest_only", label: "Suggest Only", description: "AI suggests, you execute" },
  { value: "manual", label: "Manual", description: "You handle everything" },
];

const categoryLabels: Record<string, string> = {
  scheduling: "Scheduling",
  follow_up: "Follow-ups",
  lead_response: "Lead Responses",
  client_communication: "Client Communication",
  payment_discussion: "Payment Discussion",
  admin: "Admin Tasks",
};

function useTrustRules() {
  return useQuery<{ rules: TrustRule[] }>({
    queryKey: ["trust"],
    queryFn: async () => {
      const res = await fetch("/api/trust");
      if (!res.ok) return { rules: [] };
      return res.json();
    },
  });
}

function useUpdateRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rules: TrustRule[]) => {
      const res = await fetch("/api/trust", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trust"] }),
  });
}

export default function V3TrustPage() {
  const { data, isLoading } = useTrustRules();
  const updateMutation = useUpdateRules();
  const [localRules, setLocalRules] = useState<TrustRule[]>([]);

  useEffect(() => {
    if (data?.rules) setLocalRules(data.rules);
  }, [data?.rules]);

  const handleChange = (id: string, level: string) => {
    setLocalRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, autonomyLevel: level } : r))
    );
  };

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Shield size={16} />
            Trust Rules
          </span>
        </div>
        <div className="v3-page-header-right">
          <button
            className="v3-btn-primary"
            onClick={() => updateMutation.mutate(localRules)}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        <p style={{ fontSize: 13, color: "var(--v3-text-tertiary)", marginBottom: 24 }}>
          Control how much autonomy the AI has for each type of interaction. You can always adjust these settings.
        </p>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>Loading...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {localRules.map((rule) => (
              <div key={rule.id} className="v3-card" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                      {categoryLabels[rule.category] || rule.category}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--v3-text-ghost)" }}>
                      {autonomyLevels.find((l) => l.value === rule.autonomyLevel)?.description}
                    </div>
                  </div>
                  <select
                    className="v3-select"
                    value={rule.autonomyLevel}
                    onChange={(e) => handleChange(rule.id, e.target.value)}
                    style={{ width: 180 }}
                  >
                    {autonomyLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
