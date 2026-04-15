"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Sparkles, Check, X, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface LearnedPreference {
  id: string;
  observation: string;
  evidence: { source?: string } | null;
  confidence: string;
  status: string;
  appliesTo: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  suggested: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  rejected: "bg-stone-100 text-stone-400 line-through",
  auto_applied: "bg-indigo-50 text-indigo-700",
};

const APPLIES_TO_LABELS: Record<string, string> = {
  triage: "Email Triage",
  timing: "Follow-up Timing",
  tone: "Communication Tone",
  autonomy: "Autonomy Levels",
  alerts: "Notification Rules",
};

function usePreferences() {
  return useQuery<{ preferences: LearnedPreference[] }>({
    queryKey: ["learning"],
    queryFn: async () => {
      const res = await fetch("/api/learning");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

function useAnalyze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/learning", { method: "POST" });
      if (!res.ok) throw new Error("Failed to analyze");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning"] }),
  });
}

function useUpdatePreference() {
  const qc = useQueryClient();
  return useMutation({
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
}

function PreferenceCard({ pref }: { pref: LearnedPreference }) {
  const updateMutation = useUpdatePreference();
  const confidence = parseFloat(pref.confidence);

  return (
    <Card className="border-stone-200 shadow-none">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-stone-700 leading-relaxed">
            {pref.observation}
          </p>
          <Badge
            className={`text-[10px] shrink-0 ${STATUS_STYLES[pref.status] ?? ""}`}
          >
            {pref.status}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-stone-400">
          {pref.appliesTo && (
            <span>{APPLIES_TO_LABELS[pref.appliesTo] ?? pref.appliesTo}</span>
          )}
          <span>
            Confidence: {Math.round(confidence * 100)}%
          </span>
          {pref.evidence?.source && (
            <span className="truncate max-w-[200px]">
              Evidence: {pref.evidence.source}
            </span>
          )}
        </div>

        {pref.status === "suggested" && (
          <div className="flex gap-1.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2 gap-1"
              onClick={() =>
                updateMutation.mutate({
                  preferenceId: pref.id,
                  action: "confirm",
                })
              }
            >
              <Check className="h-3 w-3" />
              Correct
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2 gap-1"
              onClick={() =>
                updateMutation.mutate({
                  preferenceId: pref.id,
                  action: "reject",
                })
              }
            >
              <X className="h-3 w-3" />
              Not True
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2 gap-1 text-indigo-600"
              onClick={() =>
                updateMutation.mutate({
                  preferenceId: pref.id,
                  action: "auto_apply",
                })
              }
            >
              <Zap className="h-3 w-3" />
              Use Automatically
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LearningPage() {
  const { data, isLoading } = usePreferences();
  const analyzeMutation = useAnalyze();
  const preferences = data?.preferences ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-semibold text-stone-900">
            What I&apos;ve Learned
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="text-xs gap-1.5"
        >
          <Sparkles
            className={`h-3.5 w-3.5 ${analyzeMutation.isPending ? "animate-pulse" : ""}`}
          />
          {analyzeMutation.isPending ? "Analyzing..." : "Analyze patterns"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : preferences.length === 0 ? (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-16 text-center space-y-3">
            <Brain className="h-10 w-10 text-stone-300 mx-auto" />
            <h2 className="text-base font-semibold text-stone-900">
              No patterns detected yet
            </h2>
            <p className="text-sm text-stone-500 max-w-sm mx-auto">
              As you approve, reject, and edit agent actions, the system will
              learn your preferences and surface them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {preferences.map((pref) => (
            <PreferenceCard key={pref.id} pref={pref} />
          ))}
        </div>
      )}
    </div>
  );
}
