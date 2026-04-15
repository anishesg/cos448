"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const BUSINESS_TYPES = [
  { value: "consultant", label: "Consultant" },
  { value: "lawyer", label: "Lawyer / Legal" },
  { value: "designer", label: "Designer / Creative" },
  { value: "recruiter", label: "Recruiter" },
  { value: "coach", label: "Coach / Trainer" },
  { value: "marketing", label: "Marketing / PR" },
  { value: "financial_advisor", label: "Financial Advisor" },
  { value: "developer", label: "Developer / IT" },
  { value: "therapist", label: "Therapist / Health" },
  { value: "other", label: "Other" },
];

const STEPS = [
  { id: "business", title: "Your Business" },
  { id: "clients", title: "Your Clients" },
  { id: "preferences", title: "How You Work" },
  { id: "ready", title: "Ready" },
];

interface OnboardingData {
  businessName: string;
  businessType: string;
  businessWebsite: string;
  timezone: string;
  answers: {
    idealClients: string;
    urgentMeans: string;
    neverAutoSend: string;
    meetingTypes: string;
    pricingSensitivity: string;
    protectedBlocks: string;
    communicationStyle: string;
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    businessName: "",
    businessType: "",
    businessWebsite: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    answers: {
      idealClients: "",
      urgentMeans: "",
      neverAutoSend: "",
      meetingTypes: "",
      pricingSensitivity: "",
      protectedBlocks: "",
      communicationStyle: "",
    },
  });

  const update = (field: keyof OnboardingData, value: string) =>
    setData({ ...data, [field]: value });

  const updateAnswer = (field: string, value: string) =>
    setData({
      ...data,
      answers: { ...data.answers, [field]: value },
    });

  const handleComplete = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center">
            <span className="text-lg font-bold text-white">C</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900">
            Set up ClientOps
          </h1>
          <p className="text-sm text-stone-500">
            Help the agent understand your business so it can be useful from day one.
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-indigo-600" : "bg-stone-200"}`}
            />
          ))}
        </div>

        {/* Step content */}
        <Card className="border-stone-200 shadow-none">
          <CardContent className="p-6 space-y-5">
            {step === 0 && (
              <>
                <h2 className="text-base font-semibold text-stone-900">
                  Tell us about your business
                </h2>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Business name</Label>
                    <Input
                      value={data.businessName}
                      onChange={(e) => update("businessName", e.target.value)}
                      placeholder="Acme Consulting"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Business type</Label>
                    <Select
                      value={data.businessType}
                      onValueChange={(v: string | null) => {
                        if (v) update("businessType", v);
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select your business type" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Website</Label>
                    <Input
                      value={data.businessWebsite}
                      onChange={(e) =>
                        update("businessWebsite", e.target.value)
                      }
                      placeholder="https://yoursite.com"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-base font-semibold text-stone-900">
                  Your clients
                </h2>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      What kinds of clients matter most?
                    </Label>
                    <Textarea
                      value={data.answers.idealClients}
                      onChange={(e) =>
                        updateAnswer("idealClients", e.target.value)
                      }
                      placeholder="e.g., Series A startups looking for brand strategy, mid-size law firms needing design..."
                      className="text-sm min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      What counts as urgent in your business?
                    </Label>
                    <Textarea
                      value={data.answers.urgentMeans}
                      onChange={(e) =>
                        updateAnswer("urgentMeans", e.target.value)
                      }
                      placeholder="e.g., Client deadline tomorrow, prospect asking about pricing, payment issue..."
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      What should the agent never auto-send?
                    </Label>
                    <Textarea
                      value={data.answers.neverAutoSend}
                      onChange={(e) =>
                        updateAnswer("neverAutoSend", e.target.value)
                      }
                      placeholder="e.g., Anything about pricing, legal language, client complaints..."
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-base font-semibold text-stone-900">
                  How you work
                </h2>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      What types of meetings do you typically have?
                    </Label>
                    <Textarea
                      value={data.answers.meetingTypes}
                      onChange={(e) =>
                        updateAnswer("meetingTypes", e.target.value)
                      }
                      placeholder="e.g., 30-min discovery calls, 60-min strategy sessions, quarterly reviews..."
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      How do you feel about pricing discussions?
                    </Label>
                    <Textarea
                      value={data.answers.pricingSensitivity}
                      onChange={(e) =>
                        updateAnswer("pricingSensitivity", e.target.value)
                      }
                      placeholder="e.g., I have set rates, flexible on package deals, never discount..."
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Protected calendar blocks
                    </Label>
                    <Input
                      value={data.answers.protectedBlocks}
                      onChange={(e) =>
                        updateAnswer("protectedBlocks", e.target.value)
                      }
                      placeholder="e.g., Fridays off, no meetings before 10am"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="text-center space-y-4 py-6">
                <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="h-7 w-7 text-emerald-600" />
                </div>
                <h2 className="text-base font-semibold text-stone-900">
                  You&apos;re all set
                </h2>
                <p className="text-sm text-stone-500 max-w-sm mx-auto">
                  ClientOps will sync your Gmail, classify your inbox by business
                  meaning, and start learning how your business works.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="text-xs gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              className="text-xs gap-1"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={saving}
              className="text-xs gap-1"
            >
              {saving ? "Saving..." : "Start using ClientOps"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
