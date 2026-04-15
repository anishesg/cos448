"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { V2Card, V2CardContent } from "@/components/v2/ui/v2-card";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { PageTransition } from "@/components/v2/motion-wrapper";

interface TrustRule {
  id: string;
  category: string;
  autonomyLevel: string;
  conditions: Record<string, unknown> | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  scheduling: "Scheduling",
  follow_up: "Follow-up nudges",
  lead_reply: "Lead replies",
  client_reply: "Client replies",
  browser: "Browser actions",
  payment: "Payment-related",
  legal: "Legal / contracts",
};

const CATEGORY_DESC: Record<string, string> = {
  scheduling: "Confirming meetings, proposing times",
  follow_up: "Nudge messages when leads go quiet",
  lead_reply: "Responses to new business inquiries",
  client_reply: "Responses to active client messages",
  browser: "Portal checks, form fills, web tasks",
  payment: "Invoices, pricing discussions, payment terms",
  legal: "Contracts, agreements, legal language",
};

const AUTONOMY_LEVELS = [
  { value: "observe", label: "Observe", desc: "Watch only, never act" },
  { value: "draft_only", label: "Draft only", desc: "Create drafts for review" },
  { value: "ask_every_time", label: "Ask me", desc: "Always ask before acting" },
  { value: "auto_send", label: "Auto-send", desc: "Send automatically" },
  { value: "auto_act", label: "Auto-act", desc: "Full autonomy" },
];

const AUTONOMY_BADGE: Record<
  string,
  "muted" | "cyan" | "amber" | "green" | "purple"
> = {
  observe: "muted",
  draft_only: "cyan",
  ask_every_time: "amber",
  auto_send: "green",
  auto_act: "purple",
};

const orderedCategories = [
  "scheduling",
  "follow_up",
  "lead_reply",
  "client_reply",
  "browser",
  "payment",
  "legal",
];

export default function V2TrustPage() {
  const qc = useQueryClient();
  const { data } = useQuery<{ rules: TrustRule[] }>({
    queryKey: ["trust-rules"],
    queryFn: async () => {
      const res = await fetch("/api/trust");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      category: string;
      autonomyLevel: string;
      conditions?: Record<string, unknown>;
    }) => {
      const res = await fetch("/api/trust", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trust-rules"] }),
  });

  const rules = data?.rules ?? [];
  const ruleMap = new Map(rules.map((r) => [r.category, r]));

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] space-y-8 px-8 py-10">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
              "bg-gradient-to-br from-[#00e87b] to-[#00d4ff]",
              "shadow-[0_0_24px_rgba(0,232,123,0.4),0_0_32px_rgba(0,212,255,0.15),inset_0_1px_0_rgba(255,255,255,0.25)]"
            )}
          >
            <Shield className="h-5 w-5 text-[#08080f]" strokeWidth={2.25} />
          </div>
          <h1 className="v2-text-gradient text-[24px] font-bold tracking-[-0.02em]">
            Trust Console
          </h1>
        </div>

        <V2Card hover={false}>
          <V2CardContent className="space-y-0 p-0">
            <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-5">
              <h2 className="text-[14px] font-semibold text-[color:var(--v2-text-primary)]">
                Autonomy Levels
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--v2-text-secondary)]">
                Control what the agent can do on its own vs. what needs your
                approval.
              </p>
            </div>

            {orderedCategories.map((category, idx) => {
              const rule = ruleMap.get(category);
              const currentLevel = rule?.autonomyLevel ?? "observe";
              const currentLabel =
                AUTONOMY_LEVELS.find((l) => l.value === currentLevel)?.label ??
                currentLevel;

              return (
                <div key={category}>
                  {idx > 0 && (
                    <div className="mx-6 border-t border-[rgba(255,255,255,0.04)]" />
                  )}
                  <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-[color:var(--v2-text-primary)]">
                          {CATEGORY_LABELS[category] ?? category}
                        </span>
                        <V2Badge color={AUTONOMY_BADGE[currentLevel] ?? "muted"}>
                          {currentLabel}
                        </V2Badge>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--v2-text-tertiary)]">
                        {CATEGORY_DESC[category]}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "flex w-full shrink-0 flex-wrap gap-0.5 rounded-[10px] border border-[rgba(255,255,255,0.06)]",
                        "bg-[rgba(255,255,255,0.025)] p-0.5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                        "sm:w-auto sm:flex-nowrap"
                      )}
                    >
                      {AUTONOMY_LEVELS.map((level) => {
                        const isActive = currentLevel === level.value;
                        return (
                          <button
                            key={level.value}
                            type="button"
                            onClick={() =>
                              updateMutation.mutate({
                                category,
                                autonomyLevel: level.value,
                              })
                            }
                            title={`${level.label} — ${level.desc}`}
                            className={cn(
                              "rounded-[10px] px-2.5 py-1.5 text-[10px] font-semibold transition-all duration-150",
                              isActive
                                ? cn(
                                    "bg-gradient-to-r from-[#00e87b] to-[#00d4ff] text-[#08080f]",
                                    "shadow-[0_0_16px_rgba(0,232,123,0.35),0_0_28px_rgba(0,212,255,0.2),inset_0_1px_0_rgba(255,255,255,0.35)]"
                                  )
                                : cn(
                                    "text-[color:var(--v2-text-tertiary)]",
                                    "hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--v2-text-secondary)]"
                                  )
                            )}
                          >
                            {level.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </V2CardContent>
        </V2Card>

        <V2Card hover={false}>
          <V2CardContent className="relative overflow-hidden p-6">
            <div
              className={cn(
                "pointer-events-none absolute -top-20 left-1/2 h-44 w-[85%] -translate-x-1/2",
                "rounded-full bg-gradient-to-r from-[#00e87b]/12 via-[#a855f7]/10 to-[#00d4ff]/12 blur-3xl"
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute -bottom-12 right-0 h-36 w-36 translate-x-1/4 rounded-full",
                "bg-gradient-to-tr from-[#00e87b]/10 via-[#a855f7]/8 to-transparent blur-2xl"
              )}
            />
            <div className="relative">
              <h2 className="text-[14px] font-semibold text-[color:var(--v2-text-primary)]">
                What I&apos;ve Learned
              </h2>
              <p className="mt-1 text-[12px] text-[color:var(--v2-text-secondary)]">
                Patterns detected from your behavior.
              </p>
              <p className="mt-3 text-[12px] italic leading-relaxed text-[color:var(--v2-text-tertiary)]">
                As you use the system, learned preferences will appear here.
              </p>
            </div>
          </V2CardContent>
        </V2Card>
      </div>
    </PageTransition>
  );
}
