"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Monitor,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  X,
} from "lucide-react";

interface BrowserTask {
  id: string;
  objective: string;
  tier: number;
  targetUrl: string;
  status: string;
  createdAt: string;
  result?: Record<string, unknown>;
}

function useBrowserTasks() {
  return useQuery<{ tasks: BrowserTask[] }>({
    queryKey: ["browser-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/browser");
      if (!res.ok) return { tasks: [] };
      return res.json();
    },
  });
}

function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { objective: string; targetUrl?: string }) => {
      const res = await fetch("/api/browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["browser-tasks"] }),
  });
}

function useApproveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch("/api/browser", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "approve" }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["browser-tasks"] }),
  });
}

export default function V3OperatorPage() {
  const { data, isLoading } = useBrowserTasks();
  const createMutation = useCreateTask();
  const approveMutation = useApproveTask();
  const [showCreate, setShowCreate] = useState(false);
  const [objective, setObjective] = useState("");
  const [url, setUrl] = useState("");
  const tasks = data?.tasks ?? [];

  const statusIcons: Record<string, typeof CheckCircle> = {
    completed: CheckCircle,
    pending: Clock,
    failed: AlertTriangle,
    approved: CheckCircle,
  };

  const statusColors: Record<string, string> = {
    completed: "v3-badge-green",
    pending: "v3-badge-amber",
    failed: "v3-badge-red",
    approved: "v3-badge-blue",
  };

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Monitor size={16} />
            Browser Operator
          </span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New task
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="v3-empty-state">
            <Monitor size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>Browser Operator</h3>
            <p>Create browser tasks to automate web interactions.</p>
            <button className="v3-btn-primary" style={{ marginTop: 20 }} onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New task
            </button>
          </div>
        ) : (
          <table className="v3-table">
            <thead>
              <tr>
                <th>Objective</th>
                <th>URL</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const Icon = statusIcons[t.status] || Clock;
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>{t.objective}</td>
                    <td>
                      {t.targetUrl && (
                        <a
                          href={t.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--v3-text-link)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          {new URL(t.targetUrl).hostname}
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </td>
                    <td><span className="v3-badge v3-badge-default">Tier {t.tier}</span></td>
                    <td>
                      <span className={`v3-badge ${statusColors[t.status] || "v3-badge-default"}`}>
                        <Icon size={10} />
                        {t.status}
                      </span>
                    </td>
                    <td>
                      {t.status === "pending" && (
                        <button
                          className="v3-btn-secondary"
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          onClick={() => approveMutation.mutate(t.id)}
                          disabled={approveMutation.isPending}
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="v3-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="v3-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="v3-modal-header">
              <div className="v3-modal-title">
                <Monitor size={16} />
                New Browser Task
              </div>
              <button className="v3-topbar-btn-icon" onClick={() => setShowCreate(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="v3-modal-body">
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginBottom: 4, display: "block" }}>Objective</label>
                <input className="v3-input" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What should the browser do?" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginBottom: 4, display: "block" }}>Target URL (optional)</label>
                <input className="v3-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="v3-modal-footer">
              <button className="v3-btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="v3-btn-primary"
                onClick={() => {
                  createMutation.mutate({ objective, targetUrl: url || undefined });
                  setShowCreate(false);
                  setObjective("");
                  setUrl("");
                }}
                disabled={!objective}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
