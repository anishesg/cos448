"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Users,
  ArrowRight,
  Star,
  Mail,
  Calendar,
  Search,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

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
  { key: "new", label: "New", color: "bg-stone-100 text-stone-700" },
  { key: "engaged", label: "Engaged", color: "bg-blue-50 text-blue-700" },
  { key: "draft_ready", label: "Draft Ready", color: "bg-amber-50 text-amber-700" },
  { key: "contacted", label: "Contacted", color: "bg-indigo-50 text-indigo-700" },
  { key: "meeting_scheduled", label: "Meeting Set", color: "bg-emerald-50 text-emerald-700" },
] as const;

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <Card
      className="border-stone-200 shadow-none hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-900 truncate">
              {lead.name ?? lead.email}
            </p>
            {lead.company && (
              <p className="text-[11px] text-stone-500 truncate">{lead.company}</p>
            )}
          </div>
          {lead.fitScore != null && (
            <div className="flex items-center gap-1 shrink-0">
              <Star className="h-3 w-3 text-amber-500" />
              <span className="text-[11px] font-semibold text-stone-600">
                {lead.fitScore}
              </span>
            </div>
          )}
        </div>

        {lead.notes && (
          <p className="text-[11px] text-stone-500 line-clamp-2">{lead.notes}</p>
        )}

        <div className="flex items-center gap-3 text-[10px] text-stone-400">
          {lead.totalInteractions != null && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {lead.totalInteractions} msgs
            </span>
          )}
          {lead.lastContactAt && (
            <span>
              {formatDistanceToNow(new Date(lead.lastContactAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {lead.recentThreads.length > 0 && (
          <div className="border-t border-stone-100 pt-1.5 mt-1.5">
            {lead.recentThreads.slice(0, 1).map((t) => (
              <p key={t.id} className="text-[11px] text-stone-500 truncate">
                {t.subject}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StageColumn({
  stage,
  leads,
  onLeadClick,
}: {
  stage: (typeof STAGE_CONFIG)[number];
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}) {
  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Badge className={`text-[10px] ${stage.color}`}>
          {stage.label}
        </Badge>
        <span className="text-[11px] text-stone-400">{leads.length}</span>
      </div>
      <div className="space-y-2 flex-1">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center">
            <p className="text-[11px] text-stone-400">No leads</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadsPage() {
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
      router.push(`/dashboard/threads/${lead.recentThreads[0].id}`);
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-semibold text-stone-900">
            Lead Pipeline
          </h1>
          {total > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {total} total
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-[260px] shrink-0 rounded-lg" />
          ))}
        </div>
      ) : stages ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_CONFIG.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage}
              leads={stages[stage.key] ?? []}
              onLeadClick={handleLeadClick}
            />
          ))}
        </div>
      ) : (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-16 text-center space-y-2">
            <Users className="h-8 w-8 text-stone-300 mx-auto" />
            <p className="text-sm text-stone-500">
              No leads yet. Sync your email to auto-detect leads.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
