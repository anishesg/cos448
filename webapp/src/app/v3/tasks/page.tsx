"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  SlidersHorizontal,
  ArrowUpDown,
  CheckSquare,
  X,
  Calendar,
  User,
  Link as LinkIcon,
} from "lucide-react";

interface WatchtowerAlert {
  id: string;
  type: string;
  title: string;
  description?: string;
  threadId?: string;
  contactName?: string;
  severity?: string;
}

function useWatchtowerAlerts() {
  return useQuery<{ alerts: WatchtowerAlert[] }>({
    queryKey: ["watchtower"],
    queryFn: async () => {
      const res = await fetch("/api/watchtower");
      if (!res.ok) return { alerts: [] };
      return res.json();
    },
  });
}

interface CreateTaskModalProps {
  onClose: () => void;
}

function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");

  return (
    <div className="v3-modal-overlay" onClick={onClose}>
      <div className="v3-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="v3-modal-header">
          <div className="v3-modal-title">
            <CheckSquare size={16} />
            Create task
          </div>
          <button className="v3-topbar-btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="v3-modal-body">
          <input
            className="v3-input"
            placeholder="Schedule a follow-up call with a @Contact"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            style={{ border: "none", background: "transparent", fontSize: 14, height: "auto", padding: 0, marginBottom: 16 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button className="v3-toolbar-btn">
              <Calendar size={12} />
              Today
            </button>
            <button className="v3-toolbar-btn">
              <User size={12} />
              Assigned to You
            </button>
            <button className="v3-toolbar-btn">
              <LinkIcon size={12} />
              Add record
            </button>
          </div>
        </div>
        <div className="v3-modal-footer">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--v3-text-tertiary)", marginRight: "auto" }}>
            <div className="v3-toggle" />
            Create more
          </label>
          <button className="v3-btn-secondary" onClick={onClose}>Cancel <kbd style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>ESC</kbd></button>
          <button className="v3-btn-primary">Save <kbd style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>⌘↵</kbd></button>
        </div>
      </div>
    </div>
  );
}

export default function V3TasksPage() {
  const router = useRouter();
  const { data, isLoading } = useWatchtowerAlerts();
  const [showCreate, setShowCreate] = useState(false);

  const alerts = data?.alerts ?? [];

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <CheckSquare size={16} />
            Tasks
          </span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-topbar-btn-ghost" style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>
            Help
          </button>
          <span style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>Ask Attio</span>
          <button className="v3-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New task
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="v3-toolbar">
        <button className="v3-toolbar-btn active">
          <ArrowUpDown size={12} />
          Sorted by Due date
        </button>
        <button className="v3-toolbar-btn">
          <SlidersHorizontal size={12} />
          Filter
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button className="v3-toolbar-btn">View settings</button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>
          Loading...
        </div>
      ) : alerts.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <CheckSquare size={80} strokeWidth={0.8} />
          </div>
          <h3>Tasks</h3>
          <p>No tasks yet! Create your first task to get started.</p>
          <button
            className="v3-btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} />
            New task
          </button>
        </div>
      ) : (
        <div>
          {/* Group: Today */}
          <div style={{ padding: "12px 24px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--v3-text-tertiary)", marginBottom: 8 }}>
              Today <span className="v3-badge v3-badge-default" style={{ marginLeft: 6 }}>{alerts.length}</span>
            </div>
          </div>
          <table className="v3-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Task</th>
                <th>Due date</th>
                <th>Record</th>
                <th>Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => alert.threadId && router.push(`/v3/threads/${alert.threadId}`)}
                >
                  <td>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: "1.5px solid var(--v3-text-ghost)",
                      }}
                    />
                  </td>
                  <td style={{ color: "var(--v3-text-primary)" }}>{alert.title}</td>
                  <td>
                    <span style={{ color: "var(--v3-accent-amber)", fontSize: 12 }}>Due today</span>
                  </td>
                  <td>
                    {alert.contactName && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="v3-record-dot people" />
                        {alert.contactName}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className="v3-avatar v3-avatar-sm">A</div>
                      Anish Kataria
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create task modal */}
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
