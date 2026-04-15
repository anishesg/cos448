"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Sparkles, Check, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { V2Card, V2CardContent } from "@/components/v2/ui/v2-card";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { PageTransition } from "@/components/v2/motion-wrapper";

interface LearnedPreference {
  id: string;
  observation: string;
  evidence: { source?: string } | null;
  confidence: string;
  status: string;
  appliesTo: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, "amber" | "green" | "muted" | "purple"> = {
  suggested: "amber",
  confirmed: "green",
  rejected: "muted",
  auto_applied: "purple",
};

const APPLIES_TO_LABELS: Record<string, string> = {
  triage: "Email Triage",
  timing: "Follow-up Timing",
  tone: "Communication Tone",
  autonomy: "Autonomy Levels",
  alerts: "Notification Rules",
};

function PreferenceCardV2({ pref }: { pref: LearnedPreference }) {
  const qc = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: async ({
      preferenceId,
      action,
    }: {
      preferenceId: string;
      action: string;
    }) => {
      const res = await fetch("/api/learning", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferenceId, action }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning"] }),
  });

  const confidence = parseFloat(pref.confidence);

  return (
    <V2Card>
      <V2CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "text-[13px] leading-relaxed text-[color:var(--v2-text-primary)]",
              pref.status === "rejected" &&
                "text-[color:var(--v2-text-tertiary)] line-through"
            )}
          >
            {pref.observation}
          </p>
          <V2Badge color={STATUS_BADGE[pref.status] ?? "muted"}>
            {pref.status.replace(/_/g, " ")}
          </V2Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[color:var(--v2-text-tertiary)]">
          {pref.appliesTo && (
            <span className="text-[color:var(--v2-text-secondary)]">
              {APPLIES_TO_LABELS[pref.appliesTo] ?? pref.appliesTo}
            </span>
          )}
          <div className="flex items-center gap-2.5">
            <span className="text-[color:var(--v2-text-tertiary)]">
              Confidence
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)] shadow-[inset_0_1px_0_rgba(0,0,0,0.2)]">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-[#00e87b] to-[#00d4ff]",
                  "shadow-[0_0_12px_rgba(0,232,123,0.45),0_0_20px_rgba(0,212,255,0.2)]",
                  "transition-[width] duration-300 ease-out"
                )}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className="tabular-nums text-[color:var(--v2-text-primary)]">
              {Math.round(confidence * 100)}%
            </span>
          </div>
          {pref.evidence?.source && (
            <span className="max-w-[220px] truncate text-[color:var(--v2-text-tertiary)]">
              via {pref.evidence.source}
            </span>
          )}
        </div>

        {pref.status === "suggested" && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            <V2Button
              variant="outline"
              size="sm"
              color="green"
              onClick={() =>
                updateMutation.mutate({
                  preferenceId: pref.id,
                  action: "confirm",
                })
              }
            >
              <Check className="h-3 w-3" />
              Correct
            </V2Button>
            <V2Button
              variant="ghost"
              size="sm"
              color="red"
              onClick={() =>
                updateMutation.mutate({
                  preferenceId: pref.id,
                  action: "reject",
                })
              }
            >
              <X className="h-3 w-3" />
              Not True
            </V2Button>
            <V2Button
              variant="ghost"
              size="sm"
              color="purple"
              onClick={() =>
                updateMutation.mutate({
                  preferenceId: pref.id,
                  action: "auto_apply",
                })
              }
            >
              <Zap className="h-3 w-3" />
              Auto-apply
            </V2Button>
          </div>
        )}
      </V2CardContent>
    </V2Card>
  );
}

export default function V2LearningPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{
    preferences: LearnedPreference[];
  }>({
    queryKey: ["learning"],
    queryFn: async () => {
      const res = await fetch("/api/learning");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/learning", { method: "POST" });
      if (!res.ok) throw new Error("Failed to analyze");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning"] }),
  });

  const preferences = data?.preferences ?? [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] space-y-8 px-8 py-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                "bg-gradient-to-br from-[#a855f7] to-[#ff2d87]",
                "shadow-[0_0_24px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
              )}
            >
              <Brain className="h-5 w-5 text-[#08080f]" strokeWidth={2.25} />
            </div>
            <h1 className="v2-text-gradient truncate text-[24px] font-bold tracking-[-0.02em]">
              What I&apos;ve Learned
            </h1>
          </div>

          <V2Button
            variant="outline"
            color="purple"
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="shrink-0"
          >
            <Sparkles
              className={cn(
                "h-3.5 w-3.5",
                analyzeMutation.isPending && "animate-pulse"
              )}
            />
            {analyzeMutation.isPending ? "Analyzing..." : "Analyze patterns"}
          </V2Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <V2Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : preferences.length === 0 ? (
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)]",
              "bg-[rgba(255,255,255,0.025)] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute -top-28 left-1/2 h-56 w-[140%] -translate-x-1/2",
                "rounded-full bg-gradient-to-r from-[#a855f7]/30 via-[#00d4ff]/20 to-[#00e87b]/20 blur-3xl"
              )}
            />
            <div className="relative flex flex-col items-center px-6 py-20 text-center">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-[10px]",
                  "bg-gradient-to-br from-[#a855f7] to-[#00d4ff]",
                  "shadow-[0_0_28px_rgba(168,85,247,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]"
                )}
              >
                <Brain className="h-7 w-7 text-[#08080f]" strokeWidth={2.25} />
              </div>
              <h2 className="v2-text-gradient mt-4 text-[16px] font-semibold tracking-[-0.01em]">
                No patterns detected yet
              </h2>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[color:var(--v2-text-secondary)]">
                As you approve, reject, and edit agent actions, the system will
                learn your preferences and surface them here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {preferences.map((pref) => (
              <PreferenceCardV2 key={pref.id} pref={pref} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
