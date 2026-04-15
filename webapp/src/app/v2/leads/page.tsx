"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TrendingUp, Users, Star, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Card, V2CardContent } from "@/components/v2/ui/v2-card";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { PageTransition } from "@/components/v2/motion-wrapper";

interface Lead {
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
  stage: string;
  researchSummary: string | null;
  recentThreads: Array<{
    id: string;
    subject: string | null;
    currentState: string | null;
    lastMessageAt: string | null;
  }>;
}

interface StageData {
  new: Lead[];
  engaged: Lead[];
  draft_ready: Lead[];
  contacted: Lead[];
  meeting_scheduled: Lead[];
}

const STAGE_CONFIG = [
  { key: "new", label: "New", color: "muted" as const },
  { key: "engaged", label: "Engaged", color: "cyan" as const },
  { key: "draft_ready", label: "Draft Ready", color: "amber" as const },
  { key: "contacted", label: "Contacted", color: "purple" as const },
  { key: "meeting_scheduled", label: "Meeting Set", color: "green" as const },
] as const;

const STAGE_ACCENT: Record<string, string> = {
  new: "from-[rgba(46,46,64,0.45)]",
  engaged: "from-[rgba(0,212,255,0.22)]",
  draft_ready: "from-[rgba(255,184,0,0.22)]",
  contacted: "from-[rgba(168,85,247,0.22)]",
  meeting_scheduled: "from-[rgba(0,232,123,0.22)]",
};

function LeadCardV2({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <V2Card className="cursor-pointer" onClick={onClick}>
      <V2CardContent className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-[var(--v2-text-primary)]">
              {lead.name ?? lead.email}
            </p>
            {lead.company && (
              <p className="truncate text-[11px] text-[var(--v2-text-secondary)]">
                {lead.company}
              </p>
            )}
          </div>
          {lead.fitScore != null && (
            <div className="flex items-center gap-1 shrink-0">
              <Star className="h-3 w-3 text-[#ffb800]" />
              <span className="text-[11px] font-semibold text-[#ffb800] tabular-nums">
                {lead.fitScore}
              </span>
            </div>
          )}
        </div>

        {lead.notes && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--v2-text-secondary)]">
            {lead.notes}
          </p>
        )}

        <div className="flex items-center gap-3 text-[10px] text-[var(--v2-text-tertiary)]">
          {lead.totalInteractions != null && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {lead.totalInteractions} msgs
            </span>
          )}
          {lead.lastContactAt && (
            <span>
              {formatDistanceToNow(new Date(lead.lastContactAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>

        {lead.recentThreads.length > 0 && (
          <div className="border-t border-[rgba(255,255,255,0.06)] pt-2">
            {lead.recentThreads.slice(0, 1).map((t) => (
              <p
                key={t.id}
                className="truncate text-[11px] text-[var(--v2-text-secondary)]"
              >
                {t.subject}
              </p>
            ))}
          </div>
        )}
      </V2CardContent>
    </V2Card>
  );
}

function StageColumnV2({
  stage,
  leads,
  onLeadClick,
}: {
  stage: (typeof STAGE_CONFIG)[number];
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-[240px] max-w-[280px] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-3 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent opacity-80 blur-xl",
          STAGE_ACCENT[stage.key]
        )}
      />
      <div className="relative mb-3 flex items-center gap-2 px-1">
        <V2Badge color={stage.color} dot className="text-[10px]">
          {stage.label}
        </V2Badge>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--v2-text-tertiary)]">
          {leads.length}
        </span>
      </div>
      <div className="relative flex-1 space-y-2">
        {leads.map((lead) => (
          <LeadCardV2
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl">
            <p className="text-[11px] text-[var(--v2-text-tertiary)]">No leads</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function V2LeadsPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery<{
    leads: Lead[];
    stages: StageData;
    total: number;
  }>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const stages = data?.stages;
  const total = data?.total ?? 0;

  const handleLeadClick = (lead: Lead) => {
    if (lead.recentThreads[0]) {
      router.push(`/v2/threads/${lead.recentThreads[0].id}`);
    }
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00e87b] to-[#00d4ff] shadow-[0_0_20px_rgba(0,232,123,0.15)]">
            <TrendingUp className="h-[18px] w-[18px] text-[#08080f]" strokeWidth={2.2} />
          </div>
          <h1 className="v2-text-gradient text-[24px] font-bold tracking-[-0.02em]">
            Lead Pipeline
          </h1>
          {total > 0 && (
            <V2Badge color="muted">{total} total</V2Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <V2Skeleton
                key={i}
                className="h-64 w-[260px] shrink-0 rounded-2xl"
              />
            ))}
          </div>
        ) : stages ? (
          <div className="flex gap-4 overflow-x-auto pb-4 v2-scrollbar">
            {STAGE_CONFIG.map((stage) => (
              <StageColumnV2
                key={stage.key}
                stage={stage}
                leads={stages[stage.key] ?? []}
                onLeadClick={handleLeadClick}
              />
            ))}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] py-24 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
            <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-56 -translate-x-1/2 rounded-full bg-gradient-to-b from-[rgba(0,232,123,0.12)] via-[rgba(0,212,255,0.06)] to-transparent blur-3xl" />
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00e87b] to-[#00d4ff] shadow-[0_0_24px_rgba(0,232,123,0.2)]">
              <Users className="h-7 w-7 text-[#08080f]" strokeWidth={2} />
            </div>
            <h2 className="v2-text-gradient relative mt-5 text-[18px] font-bold tracking-[-0.02em]">
              No leads yet
            </h2>
            <p className="relative mt-2 max-w-sm px-6 text-[14px] text-[var(--v2-text-secondary)]">
              Sync your email to auto-detect leads.
            </p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
