"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface LoopPanelProps {
  thread: {
    agentObjective: string | null;
    currentState: string | null;
    businessCategory: string | null;
    urgency: string | null;
    businessLeverage: string | null;
    classification: {
      summary?: string;
      recommendedAction?: string;
      confidence?: number;
    } | null;
  };
}

const STATE_LABELS: Record<string, string> = {
  received: "Received",
  classified: "Classified",
  hidden: "Hidden",
  draft_ready: "Draft Ready",
  awaiting_response: "Awaiting Response",
  follow_up_due: "Follow-up Due",
  stale: "Stale",
  closed: "Closed",
};

export function LoopPanel({ thread }: LoopPanelProps) {
  const classification = thread.classification;

  return (
    <div className="space-y-4">
      {/* Objective */}
      <div className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Objective
        </h3>
        <p className="text-sm text-stone-700">
          {thread.agentObjective
            ? thread.agentObjective.replace(/_/g, " ")
            : "Not yet assigned"}
        </p>
      </div>

      <Separator className="bg-stone-100" />

      {/* State */}
      <div className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Current State
        </h3>
        <Badge variant="secondary" className="text-xs">
          {STATE_LABELS[thread.currentState ?? "received"] ??
            thread.currentState}
        </Badge>
      </div>

      <Separator className="bg-stone-100" />

      {/* Classification details */}
      {classification && (
        <>
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Analysis
            </h3>
            {classification.summary && (
              <p className="text-xs text-stone-600 leading-relaxed">
                {classification.summary}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {thread.businessCategory && (
                <Badge variant="outline" className="text-[10px]">
                  {thread.businessCategory}
                </Badge>
              )}
              {thread.urgency && (
                <Badge variant="outline" className="text-[10px]">
                  {thread.urgency} urgency
                </Badge>
              )}
              {thread.businessLeverage && thread.businessLeverage !== "none" && (
                <Badge variant="outline" className="text-[10px]">
                  {thread.businessLeverage}
                </Badge>
              )}
            </div>
            {classification.confidence != null && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{
                      width: `${Math.round(classification.confidence * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-stone-400">
                  {Math.round(classification.confidence * 100)}%
                </span>
              </div>
            )}
          </div>

          <Separator className="bg-stone-100" />

          <div className="space-y-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Recommended Action
            </h3>
            <p className="text-xs text-stone-600">
              {classification.recommendedAction?.replace(/_/g, " ") ??
                "None determined"}
            </p>
          </div>
        </>
      )}

      {/* Agent timeline placeholder */}
      <Separator className="bg-stone-100" />
      <div className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Agent Timeline
        </h3>
        <p className="text-[11px] text-stone-400 italic">
          Activity history will appear here as the agent takes actions.
        </p>
      </div>
    </div>
  );
}
