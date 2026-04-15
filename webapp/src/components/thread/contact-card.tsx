"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star,
  Mail,
  Clock,
  Search,
  ExternalLink,
  Building,
  User,
  ChevronDown,
  ChevronUp,
  Target,
  MessageCircle,
  Shield,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

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

interface ResearchData {
  id: string;
  researchType: string;
  summary: string | null;
  sources: Array<{ title: string; url: string }> | null;
  createdAt: string;
}

function useContactResearch(contactId: string | undefined) {
  return useQuery<{ research: ResearchData[] }>({
    queryKey: ["contact-research", contactId],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}/research`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!contactId,
  });
}

function useResearchContact(contactId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}/research`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-research", contactId] });
    },
  });
}

const TYPE_COLORS: Record<string, string> = {
  lead: "bg-emerald-50 text-emerald-700",
  active_client: "bg-indigo-50 text-indigo-700",
  past_client: "bg-stone-100 text-stone-600",
  vendor: "bg-amber-50 text-amber-700",
  partner: "bg-blue-50 text-blue-700",
  personal: "bg-pink-50 text-pink-700",
  institutional: "bg-purple-50 text-purple-700",
};

function parseResearchSections(summary: string) {
  const sections: Array<{
    title: string;
    content: string;
    icon: typeof User;
  }> = [];
  const sectionRegex = /### (.+)\n([\s\S]*?)(?=### |\n## |$)/g;
  let match;

  const iconMap: Record<string, typeof User> = {
    "Who They Are": User,
    "What They Care About": Target,
    "How to Sell to Them": TrendingUp,
    "Conversation Starters": MessageCircle,
    "Risk Assessment": Shield,
  };

  while ((match = sectionRegex.exec(summary)) !== null) {
    const title = match[1].trim();
    const content = match[2].trim();
    if (content) {
      sections.push({
        title,
        content,
        icon: iconMap[title] ?? Sparkles,
      });
    }
  }

  return sections;
}

function PersonaSection({
  title,
  content,
  icon: Icon,
}: {
  title: string;
  content: string;
  icon: typeof User;
}) {
  const [expanded, setExpanded] = useState(title === "How to Sell to Them");
  const lines = content
    .split("\n")
    .map((l) => l.replace(/^- /, "").trim())
    .filter(Boolean);

  return (
    <div className="border border-stone-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-stone-50/50 transition-colors"
      >
        <Icon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
        <span className="text-[11px] font-semibold text-stone-700 flex-1">
          {title}
        </span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-stone-400" />
        ) : (
          <ChevronDown className="h-3 w-3 text-stone-400" />
        )}
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1">
          {lines.map((line, i) => (
            <p key={i} className="text-[11px] text-stone-600 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContactCard({ contact }: { contact: ContactData | null }) {
  const { data: researchData, isLoading: researchLoading } =
    useContactResearch(contact?.id);
  const researchMutation = useResearchContact(contact?.id);

  if (!contact) {
    return (
      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Contact
        </h3>
        <p className="text-[11px] text-stone-400 italic">
          No contact linked to this thread
        </p>
      </div>
    );
  }

  const research = researchData?.research ?? [];
  const latestResearch = research[0];
  const personaSections = latestResearch?.summary
    ? parseResearchSections(latestResearch.summary)
    : [];

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        Contact Profile
      </h3>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-900 truncate">
              {contact.name ?? contact.email}
            </p>
            <p className="text-[11px] text-stone-500 truncate">
              {contact.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {contact.relationshipType && (
            <Badge
              className={`text-[10px] ${TYPE_COLORS[contact.relationshipType] ?? "bg-stone-100 text-stone-600"}`}
            >
              {contact.relationshipType.replace(/_/g, " ")}
            </Badge>
          )}
          {contact.relationshipStage && (
            <Badge variant="outline" className="text-[10px]">
              {contact.relationshipStage}
            </Badge>
          )}
          {contact.revenuePotential && (
            <Badge className="text-[10px] bg-emerald-50 text-emerald-700">
              ${contact.revenuePotential}
            </Badge>
          )}
        </div>

        {(contact.company || contact.role) && (
          <div className="flex items-center gap-1 text-[11px] text-stone-500">
            <Building className="h-3 w-3" />
            {[contact.role, contact.company].filter(Boolean).join(" at ")}
          </div>
        )}

        <div className="flex items-center gap-3 text-[10px] text-stone-400">
          {contact.fitScore != null && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500" />
              Fit: {contact.fitScore}/100
            </span>
          )}
          {contact.totalInteractions != null && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {contact.totalInteractions} msgs
            </span>
          )}
        </div>

        {contact.lastContactAt && (
          <p className="text-[10px] text-stone-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last contact{" "}
            {formatDistanceToNow(new Date(contact.lastContactAt), {
              addSuffix: true,
            })}
          </p>
        )}

        {contact.notes && (
          <p className="text-[11px] text-stone-600 leading-relaxed bg-stone-50 rounded p-2">
            {contact.notes}
          </p>
        )}
      </div>

      <Separator className="bg-stone-100" />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            {personaSections.length > 0
              ? "Customer Persona"
              : "Web Research"}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => researchMutation.mutate()}
            disabled={researchMutation.isPending}
            className="h-6 text-[10px] gap-1 px-2"
          >
            <Search className="h-3 w-3" />
            {researchMutation.isPending ? "Researching..." : "Research"}
          </Button>
        </div>

        {researchLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        ) : personaSections.length > 0 ? (
          <div className="space-y-1.5">
            {personaSections.map((sec, i) => (
              <PersonaSection
                key={i}
                title={sec.title}
                content={sec.content}
                icon={sec.icon}
              />
            ))}

            {latestResearch?.sources &&
              (
                latestResearch.sources as Array<{
                  title: string;
                  url: string;
                }>
              ).length > 0 && (
                <div className="pt-1 space-y-0.5">
                  <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wider">
                    Sources
                  </p>
                  {(
                    latestResearch.sources as Array<{
                      title: string;
                      url: string;
                    }>
                  )
                    .slice(0, 5)
                    .map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline truncate"
                      >
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                </div>
              )}

            {latestResearch?.createdAt && (
              <p className="text-[9px] text-stone-400 text-right">
                Researched{" "}
                {formatDistanceToNow(new Date(latestResearch.createdAt), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>
        ) : latestResearch?.summary ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-stone-600 leading-relaxed whitespace-pre-wrap">
              {latestResearch.summary}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-stone-400 italic">
            No research yet. Click &quot;Research&quot; to build a customer
            persona.
          </p>
        )}
      </div>
    </div>
  );
}
