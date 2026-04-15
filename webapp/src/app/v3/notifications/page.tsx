"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, CheckCircle, AlertCircle, Loader2, Send, Phone } from "lucide-react";
import type { LinqSetupStatus } from "@/app/api/linq/setup/route";
import type { NotificationRecord } from "@/lib/linq/notifications";

// ─── API hooks ───────────────────────────────────────────────────────────────

function useLinqStatus() {
  return useQuery<LinqSetupStatus>({
    queryKey: ["linq-status"],
    queryFn: async () => {
      const res = await fetch("/api/linq/setup");
      if (!res.ok) throw new Error("Failed to load status");
      return res.json();
    },
  });
}

function useNotificationLog() {
  return useQuery<{ notifications: NotificationRecord[] }>({
    queryKey: ["linq-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/linq/notifications");
      if (!res.ok) return { notifications: [] };
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

function useSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ownerPhone: string) => {
      const res = await fetch("/api/linq/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerPhone }),
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Setup failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["linq-status"] });
      qc.invalidateQueries({ queryKey: ["linq-notifications"] });
    },
  });
}

function useTestNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/linq/test", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["linq-notifications"] }),
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: ok ? "var(--v3-text-primary)" : "var(--v3-text-tertiary)",
      }}
    >
      {ok ? (
        <CheckCircle size={14} style={{ color: "var(--v3-green, #22c55e)" }} />
      ) : (
        <AlertCircle size={14} style={{ color: "var(--v3-text-ghost)" }} />
      )}
      {label}
    </div>
  );
}

const typeLabels: Record<string, string> = {
  hot_lead: "Hot Lead",
  urgent_thread: "Urgent Thread",
  draft_ready: "Draft Ready",
  escalation: "Escalation",
  test: "Test",
};

const typeBadges: Record<string, string> = {
  hot_lead: "v3-badge-amber",
  urgent_thread: "v3-badge-red",
  draft_ready: "v3-badge-blue",
  escalation: "v3-badge-red",
  test: "v3-badge-default",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function V3NotificationsPage() {
  const { data: status, isLoading: statusLoading } = useLinqStatus();
  const { data: logData } = useNotificationLog();
  const setupMutation = useSetup();
  const testMutation = useTestNotification();

  const [phone, setPhone] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState(false);

  const notifications = logData?.notifications ?? [];
  const isConfigured = status?.configured ?? false;

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupError(null);
    setSetupSuccess(false);
    try {
      await setupMutation.mutateAsync(phone);
      setSetupSuccess(true);
      setPhone("");
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Setup failed");
    }
  }

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Bell size={16} />
            iMessage Notifications
          </span>
          <span className={`v3-badge ${isConfigured ? "v3-badge-green" : "v3-badge-default"}`}>
            {isConfigured ? "Connected" : "Not configured"}
          </span>
        </div>
        {isConfigured && (
          <div className="v3-page-header-right">
            <button
              className="v3-btn-primary"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {testMutation.isPending ? "Sending..." : "Send test message"}
            </button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Status card ── */}
        <div className="v3-card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: "var(--v3-text-secondary)" }}>
            Linq API Configuration
          </div>
          {statusLoading ? (
            <div style={{ fontSize: 13, color: "var(--v3-text-tertiary)" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <StatusRow label="API token (LINQ_API_TOKEN)" ok={status?.tokenSet ?? false} />
              <StatusRow label="From number (LINQ_FROM_NUMBER)" ok={status?.fromNumberSet ?? false} />
              <StatusRow label="Owner phone (LINQ_OWNER_PHONE)" ok={status?.ownerPhoneSet ?? false} />
            </div>
          )}
          {!statusLoading && !isConfigured && (
            <p style={{ fontSize: 12, color: "var(--v3-text-ghost)", marginTop: 12 }}>
              Set LINQ_API_TOKEN and LINQ_FROM_NUMBER in your environment, then enter your phone number below.
            </p>
          )}
        </div>

        {/* ── Setup form (shown when not fully configured) ── */}
        {!isConfigured && !statusLoading && (
          <div className="v3-card" style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: "var(--v3-text-secondary)" }}>
              Connect your phone number
            </div>
            <form onSubmit={handleSetup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Phone size={14} style={{ color: "var(--v3-text-ghost)", flexShrink: 0 }} />
                <input
                  className="v3-input"
                  type="tel"
                  placeholder="+12223334444"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  style={{ flex: 1 }}
                />
              </div>
              <p style={{ fontSize: 12, color: "var(--v3-text-ghost)", margin: 0 }}>
                Enter the phone number that should receive iMessage notifications. Must be E.164 format.
              </p>

              {setupError && (
                <div style={{ fontSize: 12, color: "var(--v3-danger, #ef4444)", padding: "8px 12px", borderRadius: "var(--v3-radius-sm)", background: "var(--v3-tint-rose-bg)" }}>
                  {setupError}
                </div>
              )}
              {setupSuccess && (
                <div style={{ fontSize: 12, color: "var(--v3-text-primary)", padding: "8px 12px", borderRadius: "var(--v3-radius-sm)", background: "var(--v3-tint-green-bg, #f0fdf4)" }}>
                  Webhook registered successfully. Set LINQ_OWNER_PHONE to persist across restarts.
                </div>
              )}

              <div>
                <button
                  type="submit"
                  className="v3-btn-primary"
                  disabled={setupMutation.isPending || !phone}
                >
                  {setupMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle size={14} />
                  )}
                  {setupMutation.isPending ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Test result feedback ── */}
        {testMutation.isSuccess && (
          <div style={{ fontSize: 13, color: "var(--v3-text-primary)", padding: "10px 16px", borderRadius: "var(--v3-radius-md)", background: "var(--v3-tint-green-bg, #f0fdf4)", border: "1px solid var(--v3-tint-green-bd, #86efac)" }}>
            Test message sent. Check your phone.
          </div>
        )}
        {testMutation.isError && (
          <div style={{ fontSize: 13, color: "var(--v3-danger, #ef4444)", padding: "10px 16px", borderRadius: "var(--v3-radius-md)", background: "var(--v3-tint-rose-bg)", border: "1px solid var(--v3-tint-rose-bd)" }}>
            {testMutation.error instanceof Error ? testMutation.error.message : "Test failed"}
          </div>
        )}

        {/* ── Notification log ── */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--v3-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Recent notifications
          </div>

          {notifications.length === 0 ? (
            <div className="v3-empty-state">
              <Bell size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
              <h3>No notifications yet</h3>
              <p>Notifications will appear here once Linq is configured and active.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="v3-card"
                  style={{ padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}
                >
                  <span className={`v3-badge ${typeBadges[n.type] ?? "v3-badge-default"}`} style={{ flexShrink: 0, marginTop: 1 }}>
                    {typeLabels[n.type] ?? n.type}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--v3-text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {n.message}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--v3-text-ghost)", flexShrink: 0, whiteSpace: "nowrap" }}>
                    {new Date(n.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
