"use client";

import { Bell } from "lucide-react";
import { useState } from "react";

export default function V3NotificationsPage() {
  const [tab, setTab] = useState<"notifications" | "requests">("notifications");

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Bell size={16} />
            Notifications
          </span>
        </div>
        <div className="v3-page-header-right">
          <span style={{ fontSize: 12, color: "var(--v3-text-tertiary)", cursor: "pointer" }}>Settings</span>
        </div>
      </div>

      <div className="v3-tabs">
        <button className={`v3-tab ${tab === "notifications" ? "active" : ""}`} onClick={() => setTab("notifications")}>
          Notifications (0)
        </button>
        <button className={`v3-tab ${tab === "requests" ? "active" : ""}`} onClick={() => setTab("requests")}>
          Requests (0)
        </button>
      </div>

      <div className="v3-empty-state">
        <Bell size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
        <h3>No {tab === "notifications" ? "notifications" : "requests"}</h3>
        <p>
          {tab === "notifications"
            ? "Notifications will appear here when there's activity."
            : "Requests from other users will be displayed here."}
        </p>
      </div>
    </div>
  );
}
