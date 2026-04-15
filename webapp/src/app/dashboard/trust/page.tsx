"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

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
  { value: "draft_only", label: "Draft only", desc: "Create drafts for your review" },
  { value: "ask_every_time", label: "Ask me", desc: "Always ask before acting" },
  { value: "auto_send", label: "Auto-send", desc: "Send automatically within conditions" },
  { value: "auto_act", label: "Auto-act", desc: "Full autonomy within conditions" },
];

const AUTONOMY_COLOR: Record<string, string> = {
  observe: "bg-stone-100 text-stone-600",
  draft_only: "bg-blue-50 text-blue-700",
  ask_every_time: "bg-amber-50 text-amber-700",
  auto_send: "bg-emerald-50 text-emerald-700",
  auto_act: "bg-indigo-50 text-indigo-700",
};

function useTrustRules() {
  return useQuery<{ rules: TrustRule[] }>({
    queryKey: ["trust-rules"],
    queryFn: async () => {
      const res = await fetch("/api/trust");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

function useUpdateTrustRule() {
  const qc = useQueryClient();
  return useMutation({
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
}

export default function TrustConsolePage() {
  const { data, isLoading } = useTrustRules();
  const updateMutation = useUpdateTrustRule();
  const rules = data?.rules ?? [];

  const ruleMap = new Map(rules.map((r) => [r.category, r]));

  const orderedCategories = [
    "scheduling",
    "follow_up",
    "lead_reply",
    "client_reply",
    "browser",
    "payment",
    "legal",
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-stone-900">Trust Console</h1>
      </div>

      <Card className="border-stone-200 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-stone-700">
            Autonomy Levels
          </CardTitle>
          <p className="text-xs text-stone-500">
            Control what the agent can do on its own vs. what needs your
            approval.
          </p>
        </CardHeader>
        <CardContent className="space-y-0">
          {orderedCategories.map((category, idx) => {
            const rule = ruleMap.get(category);
            const currentLevel = rule?.autonomyLevel ?? "observe";

            return (
              <div key={category}>
                {idx > 0 && <Separator className="bg-stone-100 my-0" />}
                <div className="flex items-center justify-between py-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-700">
                        {CATEGORY_LABELS[category] ?? category}
                      </span>
                      <Badge
                        className={`text-[10px] ${AUTONOMY_COLOR[currentLevel] ?? ""}`}
                      >
                        {AUTONOMY_LEVELS.find((l) => l.value === currentLevel)
                          ?.label ?? currentLevel}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {CATEGORY_DESC[category]}
                    </p>
                  </div>

                  <Select
                    value={currentLevel}
                    onValueChange={(value: string | null) => {
                      if (value)
                        updateMutation.mutate({
                          category,
                          autonomyLevel: value,
                        });
                    }}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTONOMY_LEVELS.map((level) => (
                        <SelectItem
                          key={level.value}
                          value={level.value}
                          className="text-xs"
                        >
                          <div>
                            <span className="font-medium">{level.label}</span>
                            <span className="text-stone-400 ml-1">
                              — {level.desc}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* What I've Learned placeholder */}
      <Card className="border-stone-200 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-stone-700">
            What I&apos;ve Learned
          </CardTitle>
          <p className="text-xs text-stone-500">
            Patterns detected from your behavior. Coming in Week 8.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-stone-400 italic">
            As you use the system, learned preferences will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
