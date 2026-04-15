"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import {
  ArrowLeft, Send, Pencil, X, MoreHorizontal, EyeOff, Tag,
  Archive, FileText, Sparkles, Bot, User, ChevronDown, Star,
  Globe, Building, Mail, Clock, Target, Activity,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Card, V2CardContent } from "@/components/v2/ui/v2-card";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { PageTransition } from "@/components/v2/motion-wrapper";
import type { EmailThreadData } from "@/components/v2/thread-card-v2";

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

const QUOTED_REPLY_PATTERNS = [
  /^On .+ wrote:$/m,
  /^-{2,}\s*Original Message\s*-{2,}$/m,
  /^From:\s.+$/m,
];

function splitQuotedReply(text: string) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of QUOTED_REPLY_PATTERNS) {
      if (pattern.test(lines[i])) {
        const main = lines.slice(0, i).join("\n").trim();
        const quoted = lines.slice(i).join("\n").trim();
        if (main.length > 10) return { main, quoted };
      }
    }
  }
  return { main: text, quoted: null as string | null };
}

function V2MessageBubble({ msg }: { msg: Message }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const body = msg.bodyFull ?? msg.bodySummary ?? "(no content)";
  const { main, quoted } = useMemo(() => splitQuotedReply(body), [body]);

  return (
    <div className="space-y-1.5">
      <div className="whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-[var(--v2-text-primary)]">
        {main}
      </div>
      {quoted && (
        <>
          <button
            onClick={() => setShowQuoted(!showQuoted)}
            className="mt-1 flex items-center gap-1 text-[11px] text-[var(--v2-text-ghost)] transition-colors hover:text-[var(--v2-text-secondary)]"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", !showQuoted && "-rotate-90")} />
            {showQuoted ? "Hide" : "Show"} quoted text
          </button>
          {showQuoted && (
            <div className="mt-1 whitespace-pre-wrap break-words border-l-2 border-[rgba(255,255,255,0.06)] pl-3 text-[11px] leading-relaxed text-[var(--v2-text-ghost)]">
              {quoted}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function V2ContactCard({ contact }: { contact: ContactData | null }) {
  if (!contact) return null;
  return (
    <V2Card>
      <V2CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[rgba(0,232,123,0.12)] to-[rgba(0,212,255,0.08)] text-[13px] font-bold text-[#00e87b]">
            {contact.name?.[0]?.toUpperCase() ?? contact.email[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-white">
              {contact.name ?? contact.email}
            </p>
            {contact.company && (
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--v2-text-tertiary)]">
                <Building className="h-3 w-3" strokeWidth={1.5} />
                {contact.company}
                {contact.role && ` · ${contact.role}`}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2.5 text-[11px]">
          <div className="flex items-center gap-2 text-[var(--v2-text-tertiary)]">
            <Mail className="h-3 w-3" strokeWidth={1.5} />
            <span className="truncate">{contact.email}</span>
          </div>
          {contact.fitScore != null && (
            <div className="flex items-center gap-2 text-[#ffb800]">
              <Star className="h-3 w-3" strokeWidth={2} />
              <span className="font-semibold">Fit Score: {contact.fitScore}/100</span>
            </div>
          )}
          {contact.relationshipType && (
            <div className="flex items-center gap-2 text-[var(--v2-text-tertiary)]">
              <Globe className="h-3 w-3" strokeWidth={1.5} />
              <span>
                {contact.relationshipType.replace(/_/g, " ")}
                {contact.relationshipStage && ` · ${contact.relationshipStage.replace(/_/g, " ")}`}
              </span>
            </div>
          )}
          {contact.totalInteractions != null && (
            <div className="flex items-center gap-2 text-[var(--v2-text-tertiary)]">
              <Activity className="h-3 w-3" strokeWidth={1.5} />
              <span>{contact.totalInteractions} interactions</span>
            </div>
          )}
        </div>

        {contact.notes && (
          <p className="border-t border-[rgba(255,255,255,0.05)] pt-3 text-[11px] leading-relaxed text-[var(--v2-text-tertiary)]">
            {contact.notes}
          </p>
        )}
      </V2CardContent>
    </V2Card>
  );
}

function V2LoopPanel({ thread }: { thread: EmailThreadData }) {
  return (
    <V2Card>
      <V2CardContent className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--v2-text-ghost)]">
          Agent Loop
        </h3>
        <div className="space-y-3">
          {thread.agentObjective && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--v2-text-ghost)]">
                <Target className="h-3 w-3" strokeWidth={1.5} />
                Objective
              </div>
              <p className="text-[12px] font-medium text-[var(--v2-text-secondary)]">
                {thread.agentObjective.replace(/_/g, " ")}
              </p>
            </div>
          )}
          {thread.currentState && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--v2-text-ghost)]">
                <Activity className="h-3 w-3" strokeWidth={1.5} />
                State
              </div>
              <V2Badge
                color={
                  thread.currentState === "draft_ready"
                    ? "purple"
                    : thread.currentState === "meeting_scheduled"
                      ? "green"
                      : "muted"
                }
              >
                {thread.currentState.replace(/_/g, " ")}
              </V2Badge>
            </div>
          )}
          {thread.classification?.recommendedAction && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--v2-text-ghost)]">
                <Clock className="h-3 w-3" strokeWidth={1.5} />
                Recommended
              </div>
              <p className="text-[12px] font-semibold text-[#00d4ff]">
                {thread.classification.recommendedAction.replace(/_/g, " ")}
              </p>
            </div>
          )}
          {thread.classification?.confidence != null && (
            <div className="space-y-2">
              <div className="text-[11px] text-[var(--v2-text-ghost)]">Confidence</div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.04)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00e87b] to-[#00d4ff] transition-all"
                  style={{ width: `${thread.classification.confidence * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </V2CardContent>
    </V2Card>
  );
}

export default function V2ThreadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.id as string;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{
    thread: EmailThreadData;
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
  });

  const actionMutation = useMutation({
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

  const draftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/draft`, { method: "POST" });
      if (!res.ok) throw new Error("Draft failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["thread", threadId] }),
  });

  const sendMutation = useMutation({
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

  const [editingDraft, setEditingDraft] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1080px] space-y-4 px-8 py-10">
        <V2Skeleton className="h-8 w-64" />
        <V2Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[1080px] px-8 py-24 text-center">
        <p className="text-[var(--v2-text-tertiary)]">Thread not found</p>
      </div>
    );
  }

  const { thread, messages, contact, draft } = data;
  const handleSend = () => {
    const body = editingDraft ? draftText : draft;
    if (body) sendMutation.mutate(body);
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1080px] px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => router.push("/v2")}
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-medium text-[var(--v2-text-tertiary)] transition-all hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--v2-text-secondary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] font-bold tracking-[-0.01em] text-white">
              {thread.subject ?? "(no subject)"}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              {thread.agentObjective && (
                <span className="text-[11px] font-medium text-[var(--v2-text-tertiary)]">
                  {thread.agentObjective.replace(/_/g, " ")}
                </span>
              )}
              {thread.currentState && (
                <V2Badge color={thread.currentState === "draft_ready" ? "purple" : "muted"}>
                  {thread.currentState.replace(/_/g, " ")}
                </V2Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-[10px] p-2.5 text-[var(--v2-text-ghost)] transition-all hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--v2-text-tertiary)]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[var(--v2-bg-surface)] py-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {[
                    { action: "ignore", icon: EyeOff, label: "Hide" },
                    { action: "mark_not_business", icon: X, label: "Not business" },
                    { action: "mark_lead", icon: Tag, label: "Mark as lead" },
                    { action: "archive", icon: Archive, label: "Archive" },
                  ].map(({ action, icon: Icon, label }) => (
                    <button
                      key={action}
                      onClick={() => { actionMutation.mutate(action); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-[var(--v2-text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--v2-text-primary)]"
                    >
                      <Icon className="h-3.5 w-3.5 text-[var(--v2-text-ghost)]" strokeWidth={1.7} />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* Messages */}
          <div className="space-y-5">
            <div className="space-y-4">
              {messages.map((msg) => {
                const isOutbound = msg.direction === "outbound";
                const isAgent = msg.isAgentGenerated;

                return (
                  <div key={msg.id} className="flex gap-3.5">
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold",
                        isAgent
                          ? "bg-gradient-to-br from-[rgba(168,85,247,0.15)] to-[rgba(255,45,135,0.08)] text-[#a855f7]"
                          : isOutbound
                            ? "bg-gradient-to-br from-[rgba(0,232,123,0.12)] to-[rgba(0,212,255,0.06)] text-[#00e87b]"
                            : "bg-[rgba(255,255,255,0.04)] text-[var(--v2-text-tertiary)]"
                      )}
                    >
                      {isAgent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-semibold text-[var(--v2-text-primary)]">
                          {isAgent
                            ? "Agent Draft"
                            : msg.senderName ?? (isOutbound ? "You" : msg.senderEmail ?? "Unknown")}
                        </span>
                        {msg.sentAt && (
                          <span className="text-[10px] text-[var(--v2-text-ghost)]">
                            {format(new Date(msg.sentAt), "MMM d, h:mm a")}
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "rounded-2xl border p-4",
                          isAgent
                            ? "border-[rgba(168,85,247,0.12)] bg-[rgba(168,85,247,0.03)] backdrop-blur-sm"
                            : "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                        )}
                      >
                        <V2MessageBubble msg={msg} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Draft section */}
            {draft && !editingDraft && (
              <div className="relative overflow-hidden space-y-4 rounded-2xl border border-[rgba(168,85,247,0.15)] bg-[rgba(168,85,247,0.03)] backdrop-blur-sm p-5">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[rgba(168,85,247,0.08)] blur-2xl" />
                <div className="relative flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#a855f7]" strokeWidth={2} />
                  <span className="text-[12px] font-semibold text-[#c084fc]">AI Draft Ready</span>
                </div>
                <p className="relative whitespace-pre-wrap text-[13px] leading-[1.7] text-[var(--v2-text-primary)]">
                  {draft}
                </p>
                <div className="relative flex gap-2.5">
                  <V2Button size="sm" color="green" onClick={handleSend} disabled={sendMutation.isPending}>
                    <Send className="h-3 w-3" />
                    {sendMutation.isPending ? "Sending..." : "Send"}
                  </V2Button>
                  <V2Button variant="outline" size="sm" color="muted" onClick={() => { setDraftText(draft); setEditingDraft(true); }}>
                    <Pencil className="h-3 w-3" />
                    Edit
                  </V2Button>
                  <V2Button variant="ghost" size="sm" color="red" onClick={() => actionMutation.mutate("reject_draft")}>
                    <X className="h-3 w-3" />
                    Reject
                  </V2Button>
                </div>
              </div>
            )}

            {editingDraft && (
              <div className="space-y-4 rounded-2xl border border-[rgba(168,85,247,0.15)] bg-[rgba(168,85,247,0.03)] backdrop-blur-sm p-5">
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="min-h-[120px] w-full resize-y rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 text-[13px] leading-[1.7] text-[var(--v2-text-primary)] placeholder-[var(--v2-text-ghost)] outline-none transition-all focus:border-[rgba(168,85,247,0.2)] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.05)]"
                />
                <div className="flex gap-2.5">
                  <V2Button size="sm" color="green" onClick={handleSend} disabled={sendMutation.isPending}>
                    <Send className="h-3 w-3" />
                    {sendMutation.isPending ? "Sending..." : "Send"}
                  </V2Button>
                  <V2Button variant="ghost" size="sm" color="muted" onClick={() => setEditingDraft(false)}>
                    Cancel
                  </V2Button>
                </div>
              </div>
            )}

            {!draft && !editingDraft && (
              <div className="flex items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <span className="text-[12px] font-medium text-[var(--v2-text-tertiary)]">
                  {thread.classification?.recommendedAction === "draft_response"
                    ? "Recommended: generate a reply"
                    : "No pending agent action"}
                </span>
                <V2Button
                  variant="outline"
                  size="sm"
                  color="purple"
                  onClick={() => draftMutation.mutate()}
                  disabled={draftMutation.isPending}
                >
                  <FileText className="h-3 w-3" />
                  {draftMutation.isPending ? "Drafting..." : "Draft Reply"}
                </V2Button>
              </div>
            )}
          </div>

          {/* Right rail */}
          <aside className="hidden space-y-4 lg:block">
            <V2ContactCard contact={contact} />
            <V2LoopPanel thread={thread} />
          </aside>
        </div>
      </div>
    </PageTransition>
  );
}
