"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface EscalationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: string;
  riskFactors: string[];
  reasoning: string;
  onSend: () => void;
  onEdit: () => void;
  onTeach: (rule: string) => void;
  isSending?: boolean;
}

export function EscalationModal({
  open,
  onOpenChange,
  draft,
  riskFactors,
  reasoning,
  onSend,
  onEdit,
  onTeach,
  isSending,
}: EscalationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Needs Your Approval
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            {reasoning}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Risk factors */}
          {riskFactors.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-stone-700">
                Why I paused:
              </h4>
              <ul className="space-y-1">
                {riskFactors.map((factor, i) => (
                  <li
                    key={i}
                    className="text-xs text-stone-600 flex items-start gap-1.5"
                  >
                    <span className="text-amber-500 mt-0.5">•</span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Draft preview */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-stone-700">
              Recommended draft:
            </h4>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600 leading-relaxed max-h-48 overflow-y-auto">
              {draft}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                onClick={onSend}
                disabled={isSending}
                className="flex-1 h-8 text-xs"
              >
                {isSending ? "Sending..." : "Send As-Is"}
              </Button>
              <Button
                variant="outline"
                onClick={onEdit}
                className="flex-1 h-8 text-xs"
              >
                Edit & Send
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTeach("always_pause_discount")}
                className="text-[11px] text-stone-500 h-7 flex-1"
              >
                Teach: Always pause on discount asks
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTeach("auto_reply_pricing_floor")}
                className="text-[11px] text-stone-500 h-7 flex-1"
              >
                Teach: Auto-reply with pricing floor
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
