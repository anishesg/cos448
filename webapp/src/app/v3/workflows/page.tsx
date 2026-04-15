"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Workflow,
  Plus,
  Settings,
  Zap,
  Clock,
  CheckCircle,
  Play,
  Webhook,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";

interface WorkflowItem {
  id: string;
  threadId: string;
  workflowType: string;
  currentStage: string;
  status: string;
  objective: string;
  attemptCount: number;
  createdAt: string;
}

function useWorkflows() {
  return useQuery<{ workflows: WorkflowItem[] }>({
    queryKey: ["workflows"],
    queryFn: async () => {
      const res = await fetch("/api/workflows");
      if (!res.ok) return { workflows: [] };
      return res.json();
    },
  });
}

export default function V3WorkflowsPage() {
  const { data, isLoading } = useWorkflows();
  const [showEditor, setShowEditor] = useState(false);
  const workflows = data?.workflows ?? [];

  if (showEditor) {
    return (
      <div>
        <div className="v3-page-header">
          <div className="v3-page-header-left">
            <button
              className="v3-topbar-btn-ghost"
              onClick={() => setShowEditor(false)}
              style={{ fontSize: 12 }}
            >
              ← Workflows
            </button>
            <span className="v3-page-header-title">Untitled Workflow</span>
          </div>
          <div className="v3-page-header-right">
            <button className="v3-topbar-btn-ghost" style={{ fontSize: 12 }}>Share</button>
            <span style={{ fontSize: 12, color: "var(--v3-text-ghost)" }}>Draft</span>
            <div className="v3-toggle" />
          </div>
        </div>

        {/* Tabs */}
        <div className="v3-tabs">
          <button className="v3-tab active">Editor</button>
          <button className="v3-tab">Runs <span className="v3-tab-count">0</span></button>
          <button className="v3-tab">Settings</button>
        </div>

        {/* Warning */}
        <div
          style={{
            margin: "16px 24px",
            padding: "10px 16px",
            borderRadius: "var(--v3-radius-md)",
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--v3-text-secondary)" }}>
            ⓘ This workflow has not yet been published
          </span>
          <button className="v3-btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>
            Publish workflow
          </button>
        </div>

        <div style={{ display: "flex", height: "calc(100vh - 200px)" }}>
          {/* Canvas */}
          <div className="v3-workflow-canvas">
            <div className="v3-workflow-node">
              <Settings size={20} style={{ color: "var(--v3-text-ghost)", marginBottom: 8, margin: "0 auto 8px" }} />
              <p style={{ fontSize: 13, color: "var(--v3-text-tertiary)" }}>
                Set a trigger in the sidebar
              </p>
            </div>

            <div className="v3-divider" style={{ width: 200, margin: "24px auto" }}>
              <span>OR</span>
            </div>

            <button className="v3-btn-secondary" style={{ fontSize: 13 }}>
              <Plus size={14} />
              Start with a template
            </button>
          </div>

          {/* Right sidebar */}
          <div className="v3-right-panel">
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Select trigger</h3>
            <p style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginBottom: 16 }}>
              Pick an event to start this workflow
            </p>

            <input
              className="v3-input"
              placeholder="Search triggers..."
              style={{ marginBottom: 16 }}
            />

            <div className="v3-right-panel-section">
              <div className="v3-right-panel-label">Tasks</div>
              <button className="v3-dropdown-item" style={{ width: "100%" }}>
                <CheckCircle size={14} style={{ color: "var(--v3-accent-indigo)" }} />
                Task created
              </button>
            </div>

            <div className="v3-right-panel-section">
              <div className="v3-right-panel-label">Utilities</div>
              <button className="v3-dropdown-item" style={{ width: "100%" }}>
                <Play size={14} style={{ color: "var(--v3-accent-green)" }} />
                Manually run
              </button>
              <button className="v3-dropdown-item" style={{ width: "100%" }}>
                <Clock size={14} style={{ color: "var(--v3-accent-amber)" }} />
                Recurring schedule
              </button>
              <button className="v3-dropdown-item" style={{ width: "100%" }}>
                <Webhook size={14} style={{ color: "var(--v3-accent-purple)" }} />
                Webhook received
              </button>
            </div>

            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <div className="v3-toggle on" />
              <span style={{ fontSize: 13 }}>Connect more integrations</span>
              <ChevronRight size={14} style={{ marginLeft: "auto", color: "var(--v3-text-ghost)" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Workflow size={16} />
            Workflows
          </span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-btn-primary" onClick={() => setShowEditor(true)}>
            <Plus size={14} />
            New workflow
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading...</div>
      ) : workflows.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <Workflow size={80} strokeWidth={0.8} />
          </div>
          <h3>Workflows</h3>
          <p>Create automated workflows triggered by events.</p>
          <button className="v3-btn-primary" style={{ marginTop: 20 }} onClick={() => setShowEditor(true)}>
            <Plus size={14} />
            New workflow
          </button>
        </div>
      ) : (
        <table className="v3-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Type</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((w) => (
              <tr key={w.id} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                  {w.objective || w.workflowType}
                </td>
                <td className="v3-badge v3-badge-default">{w.workflowType}</td>
                <td>{w.currentStage}</td>
                <td>
                  <span className={`v3-badge ${w.status === "active" ? "v3-badge-green" : "v3-badge-default"}`}>
                    {w.status}
                  </span>
                </td>
                <td>{w.attemptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
