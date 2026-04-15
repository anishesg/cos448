"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Send,
  Pencil,
  X,
  MoreHorizontal,
  EyeOff,
  Tag,
  Archive,
  Calendar,
  FileText,
  Sparkles,
  Zap,
  Pause,
  Loader2,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageTimeline } from "@/components/thread/message-timeline";
import { LoopPanel } from "@/components/thread/loop-panel";
import { ContactCard } from "@/components/thread/contact-card";
import type { EmailThreadData } from "@/components/feed/thread-card";

interface Message {
  id: string;
  direction: string;
  senderEmail: string | null;
  senderName: string | null;
  bodySummary: string | null;
  bodyFull: string | null;
  sentAt: string | null;
  isAgentGenerated: boolean | null;
}

interface ContactData {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  role: string | null;
  relationshipType: string | null;
  relationshipStage: string | null;
  fitScore: number | null;
  revenuePotential: string | null;
  totalInteractions: number | null;
  lastContactAt: string | null;
  notes: string | null;
}

function useThreadDetail(threadId: string) {
  return useQuery<{
    thread: EmailThreadData & {
      automationStatus?: string | null;
      automationTurns?: number | null;
      automationMaxTurns?: number | null;
      isTestSimulation?: boolean | null;
    };
    messages: Message[];
    contact: ContactData | null;
    draft: string | null;
  }>({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch thread");
      return res.json();
    },
    enabled: !!threadId,
    refetchInterval: 10000,
  });
}

function useThreadAction(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: string) => {
      const res = await fetch(`/api/emails/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}

function useGenerateDraft(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/draft`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Draft failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
    },
  });
}

function useSendDraft(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/emails/${threadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Send failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}

function useScheduleIntent(threadId: string) {
  const qc = useQueryClient();
  const detect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/schedule`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(["schedule-intent", threadId], data);
    },
  });
  const cached = qc.getQueryData<{
    intent: {
      hasIntent: boolean;
      meetingType: string;
      topic: string;
      suggestedDuration: number;
      proposedTimes?: string[];
      confidence?: number;
    };
    slots: Array<{ start: string; end: string }>;
  }>(["schedule-intent", threadId]);
  return { detect, data: cached };
}

function useAutomate(threadId: string) {
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/automate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Automate failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
  });
  const stop = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/automate`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Stop failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
    },
  });
  return { start, stop };
}

export default function ThreadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.id as string;
  const { data, isLoading } = useThreadDetail(threadId);
  const actionMutation = useThreadAction(threadId);
  const draftMutation = useGenerateDraft(threadId);
  const sendMutation = useSendDraft(threadId);
  const automate = useAutomate(threadId);
  const schedule = useScheduleIntent(threadId);
  const [editingDraft, setEditingDraft] = useState(false);
  const [draftText, setDraftText] = useState("");

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <p className="text-stone-500">Thread not found</p>
      </div>
    );
  }

  const { thread, messages, contact, draft } = data;

  const handleSend = () => {
    const body = editingDraft ? draftText : draft;
    if (body) sendMutation.mutate(body);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="text-stone-500 gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-stone-900 truncate">
            {thread.subject ?? "(no subject)"}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {thread.agentObjective && (
              <span className="text-[11px] text-stone-500">
                Objective: {thread.agentObjective.replace(/_/g, " ")}
              </span>
            )}
            {thread.currentState && (
              <Badge variant="outline" className="text-[10px]">
                {thread.currentState.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => actionMutation.mutate("ignore")}>
              <EyeOff className="h-3.5 w-3.5 mr-2" />
              Hide
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actionMutation.mutate("mark_not_business")}>
              <X className="h-3.5 w-3.5 mr-2" />
              Not business
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actionMutation.mutate("mark_lead")}>
              <Tag className="h-3.5 w-3.5 mr-2" />
              Mark as lead
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actionMutation.mutate("archive")}>
              <Archive className="h-3.5 w-3.5 mr-2" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Center: Message timeline */}
        <div className="space-y-4">
          <MessageTimeline messages={messages} userEmail="" />

          {/* Draft section */}
          {draft && !editingDraft && (
            <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span className="text-xs font-medium text-indigo-700">
                  AI Draft Ready
                </span>
              </div>
              <p className="text-[13px] text-stone-700 whitespace-pre-wrap leading-relaxed">
                {draft}
              </p>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                >
                  <Send className="h-3 w-3" />
                  {sendMutation.isPending ? "Sending..." : "Send"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setDraftText(draft);
                    setEditingDraft(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => actionMutation.mutate("reject_draft")}
                >
                  <X className="h-3 w-3" />
                  Reject
                </Button>
              </div>
            </div>
          )}

          {editingDraft && (
            <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/50 space-y-3">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="w-full min-h-[120px] text-[13px] text-stone-700 bg-white border border-stone-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                >
                  <Send className="h-3 w-3" />
                  {sendMutation.isPending ? "Sending..." : "Send"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setEditingDraft(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Automation status bar */}
          {thread.automationStatus === "active" && (
            <div className="border border-emerald-300 rounded-lg p-3 bg-emerald-50/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bot className="h-4 w-4 text-emerald-600" />
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                  <span className="text-xs font-medium text-emerald-800">
                    Automation Active
                  </span>
                  <span className="text-[10px] text-emerald-600">
                    Turn {thread.automationTurns ?? 0} / {thread.automationMaxTurns ?? 8}
                  </span>
                  {thread.isTestSimulation && (
                    <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-700">
                      Test Sim
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => automate.stop.mutate()}
                  disabled={automate.stop.isPending}
                >
                  <Pause className="h-3 w-3" />
                  Pause
                </Button>
              </div>
            </div>
          )}

          {thread.automationStatus === "completed" && (
            <div className="space-y-3">
              <div className="border border-emerald-200 rounded-lg p-3 bg-gradient-to-r from-emerald-50/50 to-stone-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-800">
                      Automation completed
                    </span>
                    <span className="text-[10px] text-stone-500">
                      {thread.automationTurns ?? 0} turns
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      onClick={() => draftMutation.mutate()}
                      disabled={draftMutation.isPending}
                    >
                      <FileText className="h-3 w-3" />
                      {draftMutation.isPending ? "Drafting..." : "Follow Up"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                      onClick={() => schedule.detect.mutate()}
                      disabled={schedule.detect.isPending}
                    >
                      {schedule.detect.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Calendar className="h-3 w-3" />
                      )}
                      {schedule.detect.isPending
                        ? "Detecting..."
                        : "Schedule Meeting"}
                    </Button>
                  </div>
                </div>
              </div>

              {schedule.data?.intent?.hasIntent && (
                <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-medium text-indigo-800">
                      Meeting Intent Detected
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] border-indigo-200 text-indigo-600"
                    >
                      {Math.round(
                        (schedule.data.intent.confidence ?? 0) * 100
                      )}
                      % confidence
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-stone-400">Type:</span>{" "}
                      <span className="text-stone-700">
                        {schedule.data.intent.meetingType}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400">Duration:</span>{" "}
                      <span className="text-stone-700">
                        {schedule.data.intent.suggestedDuration} min
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-stone-400">Topic:</span>{" "}
                      <span className="text-stone-700">
                        {schedule.data.intent.topic}
                      </span>
                    </div>
                    {schedule.data.intent.proposedTimes &&
                      schedule.data.intent.proposedTimes.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-stone-400">
                            Client suggested:
                          </span>{" "}
                          <span className="text-stone-700">
                            {schedule.data.intent.proposedTimes.join(", ")}
                          </span>
                        </div>
                      )}
                  </div>
                  {schedule.data.slots.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">
                        Available Slots
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {schedule.data.slots.slice(0, 6).map((slot, i) => {
                          const start = new Date(slot.start);
                          const label = start.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          });
                          return (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                            >
                              {label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action bar */}
          {!draft && !editingDraft && thread.automationStatus !== "active" && (
            <div className="border border-stone-200 rounded-lg p-3 bg-stone-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500">
                  {thread.classification?.recommendedAction === "draft_response"
                    ? "Recommended: generate a reply"
                    : "No pending agent action"}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => draftMutation.mutate()}
                    disabled={draftMutation.isPending}
                  >
                    <FileText className="h-3 w-3" />
                    {draftMutation.isPending ? "Drafting..." : "Draft Reply"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                    onClick={() => automate.start.mutate()}
                    disabled={automate.start.isPending}
                  >
                    {automate.start.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    {automate.start.isPending ? "Starting..." : "Automate"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="hidden lg:block space-y-4">
          {/* Contact card */}
          <div className="border border-stone-200 rounded-lg p-4 bg-white">
            <ContactCard contact={contact} />
          </div>

          {/* Loop Panel */}
          <div className="border border-stone-200 rounded-lg p-4 bg-white">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
              Loop Panel
            </h2>
            <LoopPanel thread={thread} />
          </div>
        </aside>
      </div>
    </div>
  );
}
