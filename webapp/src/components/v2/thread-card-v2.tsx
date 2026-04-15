"use client";

import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, ArrowUpRight, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { V2Badge } from "./ui/v2-badge";

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

const URGENCY_ACCENT: Record<string, string> = {
  critical: "border-l-[#ff4060]",
  high: "border-l-[#ffb800]",
  medium: "border-l-[rgba(255,255,255,0.06)]",
  low: "border-l-transparent",
};

const URGENCY_DOT: Record<string, string> = {
  critical: "bg-[#ff4060] shadow-[0_0_8px_rgba(255,64,96,0.5)]",
  high: "bg-[#ffb800] shadow-[0_0_8px_rgba(255,184,0,0.5)]",
  medium: "bg-[var(--v2-text-ghost)]",
  low: "bg-[var(--v2-text-ghost)]",
};

type CategoryKey = "lead" | "active_client" | "scheduling" | "payment" | "admin" | "noise";

const CATEGORY_BADGE: Record<
  CategoryKey,
  { label: string; color: "green" | "cyan" | "amber" | "red" | "muted" | "purple" }
> = {
  lead: { label: "Lead", color: "green" },
  active_client: { label: "Client", color: "cyan" },
  scheduling: { label: "Schedule", color: "amber" },
  payment: { label: "Payment", color: "red" },
  admin: { label: "Admin", color: "muted" },
  noise: { label: "Noise", color: "muted" },
};

const LEVERAGE_LABEL: Record<string, string> = {
  revenue: "Revenue",
  retention: "Retention",
  operational: "Ops",
  administrative: "Admin",
};

interface ThreadCardV2Props {
  thread: EmailThreadData;
  onSelect?: (id: string) => void;
}

export function ThreadCardV2({ thread, onSelect }: ThreadCardV2Props) {
  const qc = useQueryClient();
  const catBadge = thread.businessCategory
    ? CATEGORY_BADGE[thread.businessCategory as CategoryKey]
    : null;

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

  const urgencyAccent =
    thread.currentState === "draft_ready"
      ? "border-l-[#a855f7]"
      : URGENCY_ACCENT[thread.urgency ?? "low"] ?? "border-l-transparent";

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-2xl border border-[rgba(255,255,255,0.05)] border-l-2 bg-[rgba(255,255,255,0.02)] backdrop-blur-sm transition-all duration-300",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        "hover:border-[rgba(255,255,255,0.09)] hover:bg-[rgba(255,255,255,0.04)]",
        "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_-8px_rgba(0,0,0,0.2)]",
        urgencyAccent
      )}
      onClick={() => onSelect?.(thread.id)}
    >
      <div className="space-y-3 px-5 py-[18px]">
        {/* Row 1 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {thread.urgency && URGENCY_DOT[thread.urgency] && (
              <span className={cn("h-[6px] w-[6px] shrink-0 rounded-full", URGENCY_DOT[thread.urgency])} />
            )}
            {catBadge && <V2Badge color={catBadge.color}>{catBadge.label}</V2Badge>}
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-white">
              {thread.subject ?? "(no subject)"}
            </span>
          </div>
          {thread.lastMessageAt && (
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--v2-text-ghost)]">
              {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Summary */}
        <p className="line-clamp-2 text-[12.5px] leading-[1.65] text-[var(--v2-text-secondary)]">
          {thread.classification?.summary ?? thread.snippet ?? ""}
        </p>

        {/* Draft indicator */}
        {thread.currentState === "draft_ready" && (
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[#a855f7]" strokeWidth={2} />
            <span className="text-[11px] font-semibold text-[#c084fc]">AI draft ready to review</span>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {thread.messageCount != null && thread.messageCount > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--v2-text-ghost)]">
                <Mail className="h-3 w-3" strokeWidth={1.5} />
                {thread.messageCount}
              </span>
            )}
            {thread.lastMessageDirection === "inbound" && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#00e87b]">
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
                Inbound
              </span>
            )}
            {thread.businessLeverage && thread.businessLeverage !== "none" && (
              <V2Badge color="muted">
                {LEVERAGE_LABEL[thread.businessLeverage] ?? thread.businessLeverage}
              </V2Badge>
            )}
          </div>

          <div className="flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {thread.currentState !== "draft_ready" && (
              <button
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--v2-text-tertiary)] transition-all hover:bg-[rgba(168,85,247,0.06)] hover:text-[#c084fc]"
                onClick={(e) => { e.stopPropagation(); draftMutation.mutate(); }}
                disabled={draftMutation.isPending}
              >
                <FileText className="h-3 w-3" strokeWidth={1.5} />
                {draftMutation.isPending ? "..." : "Draft"}
              </button>
            )}
            {thread.currentState === "draft_ready" && (
              <button
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#c084fc] transition-all hover:bg-[rgba(168,85,247,0.06)]"
                onClick={(e) => { e.stopPropagation(); onSelect?.(thread.id); }}
              >
                <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                Review
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
