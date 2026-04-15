"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Megaphone,
  Plus,
  Settings,
  Play,
  Users,
  Clock,
  Mail,
  MoreVertical,
  ChevronDown,
  X,
  ArrowDown,
  Star,
} from "lucide-react";

interface Campaign {
  id: string;
  campaignName: string;
  channel: string;
  status: string;
  messageTemplate: string;
  stats: { sent?: number; replied?: number } | null;
  createdAt: string;
}

function useCampaigns() {
  return useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/outreach/campaigns");
      if (!res.ok) return { campaigns: [] };
      return res.json();
    },
  });
}

interface SequenceStep {
  id: number;
  subject: string;
}

interface SequenceEditorProps {
  campaign: Campaign | null;
  onClose: () => void;
}

function SequenceEditor({ campaign, onClose: _onClose }: SequenceEditorProps) {
  const name = campaign?.campaignName || "Untitled Sequence";
  const [enabled, setEnabled] = useState(false);
  const [steps, setSteps] = useState<SequenceStep[]>([{ id: 1, subject: campaign?.campaignName || "" }]);

  const addStep = () => {
    const nextId = (steps[steps.length - 1]?.id ?? 0) + 1;
    setSteps((prev) => [...prev, { id: nextId, subject: "" }]);
  };

  const removeStep = (id: number) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSubject = (id: number, value: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, subject: value } : s)));
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 49px)" }}>
      {/* Main editor */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Editor header */}
        <div className="v3-page-header" style={{ position: "static" }}>
          <div className="v3-page-header-left">
            <span className="v3-page-header-title">
              <Megaphone size={16} style={{ color: "var(--v3-accent-purple)" }} />
              {name}
              <Star size={14} style={{ color: "var(--v3-text-ghost)", cursor: "pointer" }} />
            </span>
          </div>
          <div className="v3-page-header-right">
            <button
              className={enabled ? "v3-btn-primary" : "v3-btn-secondary"}
              style={{ fontSize: 12 }}
              onClick={() => setEnabled((e) => !e)}
            >
              {enabled ? "Sequence enabled" : "Enable sequence"}
            </button>
            <button className="v3-btn-primary" style={{ fontSize: 12 }}>Enroll recipients</button>
          </div>
        </div>

        {/* Warning banner — hide when enabled */}
        {!enabled && (
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
              ⓘ This sequence has not yet been published
            </span>
            <button
              className="v3-btn-primary"
              style={{ padding: "4px 12px", fontSize: 12 }}
              onClick={() => setEnabled(true)}
            >
              Publish sequence
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="v3-tabs">
          <button className="v3-tab active">Editor</button>
          <button className="v3-tab">Recipients <span className="v3-tab-count">0</span></button>
          <button className="v3-tab">Settings</button>
        </div>

        {/* Start trigger */}
        <div style={{ padding: "24px", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--v3-text-tertiary)", marginBottom: 16 }}>
            <Clock size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
            Start <strong>immediately</strong> after enrollment
            <ChevronDown size={12} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
          </div>

          {/* Steps */}
          {steps.map((step, index) => (
            <div key={step.id}>
              <div className="v3-sequence-step">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <Mail size={14} style={{ color: "var(--v3-accent-indigo)" }} />
                    <strong>Step {index + 1}</strong> Automated email
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {index > 0 && (
                      <button
                        className="v3-topbar-btn-icon"
                        style={{ width: 24, height: 24 }}
                        onClick={() => removeStep(step.id)}
                        title="Delete step"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button className="v3-topbar-btn-icon" style={{ width: 24, height: 24 }}>
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--v3-text-tertiary)", minWidth: 50 }}>Subject</span>
                    <input
                      className="v3-input"
                      value={step.subject}
                      onChange={(e) => updateSubject(step.id, e.target.value)}
                      placeholder="Subject"
                      style={{ height: 28, fontSize: 12 }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    minHeight: 120,
                    padding: "12px",
                    borderRadius: "var(--v3-radius-sm)",
                    border: "1px solid var(--v3-border)",
                    background: "var(--v3-bg-input)",
                    fontSize: 13,
                    color: "var(--v3-text-ghost)",
                  }}
                >
                  Start typing, or pick a template (use ↑↓ to navigate)
                </div>

                <div style={{ marginTop: 12, borderTop: "1px solid var(--v3-border)", paddingTop: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--v3-text-tertiary)", marginBottom: 6 }}>
                    FAVORITE TEMPLATES
                  </p>
                  <p style={{ fontSize: 12, color: "var(--v3-text-ghost)" }}>
                    Templates that you favorite will appear here
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--v3-text-tertiary)", marginTop: 12, marginBottom: 6 }}>
                    ACTIONS
                  </p>
                  <button className="v3-toolbar-btn" style={{ fontSize: 12 }}>
                    View all templates
                  </button>
                </div>
              </div>

              {/* Connector between steps */}
              <div className="v3-sequence-connector">
                <ArrowDown size={14} />
              </div>
            </div>
          ))}

          {/* Add step */}
          <button
            className="v3-btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={addStep}
          >
            <Plus size={14} />
            Add step to sequence
          </button>
        </div>
      </div>

      {/* Right panel - settings */}
      <div className="v3-right-panel">
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Megaphone size={14} style={{ color: "var(--v3-accent-purple)" }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--v3-text-ghost)" }}>Add a description...</p>
        </div>

        <div className="v3-right-panel-section">
          <div className="v3-right-panel-label">Delivery</div>
          <div style={{ marginBottom: 12 }}>
            <div className="v3-right-panel-label" style={{ marginBottom: 4 }}>Sending window</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select className="v3-select" defaultValue="09:00" style={{ width: 80 }}>
                <option>09:00</option><option>10:00</option><option>11:00</option>
              </select>
              <span style={{ color: "var(--v3-text-ghost)" }}>-</span>
              <select className="v3-select" defaultValue="17:00" style={{ width: 80 }}>
                <option>16:00</option><option>17:00</option><option>18:00</option>
              </select>
              <span style={{ fontSize: 11, color: "var(--v3-text-ghost)" }}>America/New_Y...</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13 }}>Business days only</span>
            <div className="v3-toggle on" />
          </div>
        </div>

        <div className="v3-right-panel-section">
          <div className="v3-right-panel-label">Email</div>
          <div style={{ marginBottom: 12 }}>
            <div className="v3-right-panel-label" style={{ marginBottom: 4 }}>Unsubscribe link</div>
            <select className="v3-select" defaultValue="stop" style={{ width: "100%" }}>
              <option value="stop">Stop hearing from me</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>Thread emails</span>
            <div className="v3-toggle on" />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13 }}>Include sender signature</span>
            <div className="v3-toggle on" />
          </div>
        </div>

        <div className="v3-right-panel-section">
          <div className="v3-right-panel-label">Exit criteria</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <Mail size={14} style={{ color: "var(--v3-text-ghost)" }} />
            <span style={{ fontSize: 13 }}>Reply received</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function V3SequencesPage() {
  const { data, isLoading } = useCampaigns();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const campaigns = data?.campaigns ?? [];

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
              ← Sequences
            </button>
          </div>
        </div>
        <SequenceEditor campaign={editing} onClose={() => setShowEditor(false)} />
      </div>
    );
  }

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <div>
            <span className="v3-page-header-title">
              <Megaphone size={16} />
              Sequences
            </span>
            <p style={{ fontSize: 12, color: "var(--v3-text-ghost)", marginTop: 2, fontWeight: 400 }}>
              Automated multi-step email sequences. Enroll contacts and let AI follow up for you.
            </p>
          </div>
        </div>
        <div className="v3-page-header-right">
          <button
            className="v3-btn-primary"
            onClick={() => {
              setEditing(null);
              setShowEditor(true);
            }}
          >
            <Plus size={14} />
            New sequence
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading...</div>
      ) : campaigns.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <Megaphone size={80} strokeWidth={0.8} />
          </div>
          <h3>Sequences</h3>
          <p>Create automated email sequences to reach out to leads.</p>
          <button
            className="v3-btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => {
              setEditing(null);
              setShowEditor(true);
            }}
          >
            <Plus size={14} />
            New sequence
          </button>
        </div>
      ) : (
        <table className="v3-table">
          <thead>
            <tr>
              <th>Sequence</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Replied</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setEditing(c);
                  setShowEditor(true);
                }}
              >
                <td style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                  {c.campaignName || "Untitled"}
                </td>
                <td className="v3-badge v3-badge-default">{c.channel}</td>
                <td>
                  <span className={`v3-badge ${c.status === "active" ? "v3-badge-green" : "v3-badge-default"}`}>
                    {c.status}
                  </span>
                </td>
                <td>{(c.stats as Record<string, number>)?.sent ?? 0}</td>
                <td>{(c.stats as Record<string, number>)?.replied ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
