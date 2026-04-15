"use client";

import { Phone } from "lucide-react";

export default function V3CallsPage() {
  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Phone size={16} />
            Calls
          </span>
        </div>
      </div>

      <div className="v3-empty-state">
        <Phone size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
        <h3>Calls</h3>
        <p>Call logging and tracking will be available here. Connect your phone system to get started.</p>
      </div>
    </div>
  );
}
