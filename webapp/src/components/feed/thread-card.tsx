"use client";

import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, ArrowUpRight, FileText, Calendar, Search, Sparkles, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmailThreadData {
  id: string;
  subject: string | null;
  snippet: string | null;
  businessCategory: string | null;
  urgency: string | null;
  businessLeverage: string | null;
  currentState: string | null;
  agentObjective: string | null;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
  messageCount: number | null;
  classification: {
    summary?: string;
    recommendedAction?: string;
    confidence?: number;
  } | null;
}

const URGENCY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-yellow-400",
  low: "bg-stone-300",
};

const CATEGORY_STYLE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  lead: { label: "LEAD", variant: "default" },
  active_client: { label: "CLIENT", variant: "secondary" },
  scheduling: { label: "SCHEDULING", variant: "outline" },
  payment: { label: "PAYMENT", variant: "destructive" },
  admin: { label: "ADMIN", variant: "outline" },
  noise: { label: "NOISE", variant: "outline" },
};

const LEVERAGE_LABEL: Record<string, string> = {
  revenue: "Revenue",
  retention: "Retention",
  operational: "Ops",
  administrative: "Admin",
};

interface ThreadCardProps {
  thread: EmailThreadData;
  onSelect?: (id: string) => void;
}

export function ThreadCard({ thread, onSelect }: ThreadCardProps) {
  const qc = useQueryClient();
  const catStyle = thread.businessCategory
    ? CATEGORY_STYLE[thread.businessCategory]
    : null;
  const classification = thread.classification;

  const draftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${thread.id}/draft`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      onSelect?.(thread.id);
    },
  });

  return (
    <Card
      className={cn(
        "border-stone-200 shadow-none hover:shadow-sm transition-all cursor-pointer group",
        thread.urgency === "critical" && "border-l-2 border-l-red-400",
        thread.urgency === "high" && "border-l-2 border-l-amber-400",
        thread.currentState === "draft_ready" && "border-l-2 border-l-indigo-400"
      )}
      onClick={() => onSelect?.(thread.id)}
    >
      <CardContent className="p-4 space-y-2.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {thread.urgency && URGENCY_DOT[thread.urgency] && (
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${URGENCY_DOT[thread.urgency]}`}
              />
            )}
            {catStyle && (
              <Badge
                variant={catStyle.variant}
                className="text-[10px] font-semibold tracking-wide shrink-0"
              >
                {catStyle.label}
              </Badge>
            )}
            <span className="text-sm font-medium text-stone-900 truncate">
              {thread.subject ?? "(no subject)"}
            </span>
          </div>
          {thread.lastMessageAt && (
            <span className="text-[11px] text-stone-400 shrink-0 whitespace-nowrap">
              {formatDistanceToNow(new Date(thread.lastMessageAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>

        {/* AI summary or snippet */}
        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
          {classification?.summary ?? thread.snippet ?? ""}
        </p>

        {/* State indicator */}
        {thread.currentState === "automated" && (
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Bot className="h-3 w-3 text-emerald-500" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">
              Automation running
            </span>
          </div>
        )}
        {thread.currentState === "draft_ready" && (
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span className="text-[11px] text-indigo-600 font-medium">
              AI draft ready to review
            </span>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {thread.messageCount != null && thread.messageCount > 0 && (
              <span className="text-[11px] text-stone-400 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {thread.messageCount}
              </span>
            )}
            {thread.lastMessageDirection === "inbound" && (
              <span className="text-[11px] text-indigo-500 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                Inbound
              </span>
            )}
            {thread.businessLeverage &&
              thread.businessLeverage !== "none" && (
                <Badge variant="outline" className="text-[10px] py-0">
                  {LEVERAGE_LABEL[thread.businessLeverage] ??
                    thread.businessLeverage}
                </Badge>
              )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {thread.currentState !== "draft_ready" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  draftMutation.mutate();
                }}
                disabled={draftMutation.isPending}
              >
                <FileText className="h-3 w-3" />
                {draftMutation.isPending ? "..." : "Draft"}
              </Button>
            )}
            {thread.currentState === "draft_ready" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 gap-1 text-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(thread.id);
                }}
              >
                <Sparkles className="h-3 w-3" />
                Review
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
