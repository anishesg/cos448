"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Beaker,
  Send,
  Loader2,
  CheckCircle,
  User,
  Globe,
} from "lucide-react";

interface Persona {
  key: string;
  name: string;
  email: string;
  backstory: string;
}

export default function TestSimulationPage() {
  const [results, setResults] = useState<
    Array<{ persona: string; message: string; success: boolean }>
  >([]);

  const { data: personas } = useQuery<{ personas: Persona[] }>({
    queryKey: ["test-personas"],
    queryFn: async () => {
      const res = await fetch("/api/test/simulate");
      return res.json();
    },
  });

  const simulateMutation = useMutation({
    mutationFn: async (personaKey: string) => {
      const res = await fetch("/api/test/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaKey }),
      });
      if (!res.ok) throw new Error("Simulation failed");
      return res.json();
    },
    onSuccess: (data) => {
      setResults((prev) => [
        { persona: data.persona, message: data.message, success: true },
        ...prev,
      ]);
    },
    onError: (err) => {
      setResults((prev) => [
        { persona: "Unknown", message: String(err), success: false },
        ...prev,
      ]);
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Beaker className="h-5 w-5 text-purple-600" />
          Automation Test Lab
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Send test emails from simulated customers. Each persona sends a
          realistic inquiry. Click &quot;Automate&quot; on the resulting thread
          to start the full automation loop.
        </p>
      </div>

      <div className="space-y-3">
        {personas?.personas.map((p) => (
          <div
            key={p.key}
            className="border border-stone-200 rounded-lg p-4 bg-white hover:border-purple-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-stone-400" />
                  <span className="font-medium text-sm text-stone-900">
                    {p.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {p.email}
                  </Badge>
                </div>
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  {p.backstory}
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 shrink-0"
                onClick={() => simulateMutation.mutate(p.key)}
                disabled={simulateMutation.isPending}
              >
                {simulateMutation.isPending &&
                simulateMutation.variables === p.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Send Test Email
              </Button>
            </div>
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Activity Log
          </h2>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
                r.success
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {r.success ? (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <Globe className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-medium">{r.persona}</span>
                <p className="text-stone-600 mt-0.5">{r.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-stone-100 pt-4">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
          How it works
        </h3>
        <ol className="space-y-1.5 text-xs text-stone-500">
          <li>1. Click &quot;Send Test Email&quot; to simulate a realistic customer inquiry in your inbox</li>
          <li>2. The new thread appears in your inbox automatically</li>
          <li>3. Open the thread and click the &quot;Automate&quot; button</li>
          <li>4. Watch as the AI generates replies and the simulated customer responds naturally</li>
          <li>5. The conversation progresses toward scheduling a consultation (5 turns)</li>
        </ol>
      </div>
    </div>
  );
}
