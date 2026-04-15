"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import {
  Home,
  Bell,
  CheckSquare,
  FileText,
  Mail,
  ChevronRight,
  Search,
  LayoutGrid,
  Settings,
  UserPlus,
  BookOpen,
  Shield,
  Eye,
  Calendar,
  Monitor,
  Brain,
  Sparkles,
  X,
  MessageCircle,
  BarChart2,
  Crosshair,
  Play,
  Megaphone,
  Workflow,
  HelpCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { DemoModeButton, DemoOverlay } from "./demo-overlay";

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  badge?: number;
  active?: boolean;
}

function NavItem({ href, icon, label, badge, active }: NavItemProps) {
  return (
    <Link href={href} className={`v3-nav-item ${active ? "active" : ""}`}>
      <span className="v3-nav-item-icon">{icon}</span>
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="v3-nav-item-badge">{badge}</span>
      )}
    </Link>
  );
}

interface NavGroupProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function NavGroup({ icon, label, children, defaultOpen = false }: NavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        className={`v3-nav-group-toggle ${open ? "expanded" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span className="v3-nav-item-icon">{icon}</span>
        {label}
        <ChevronRight className="chevron" />
      </button>
      {open && <div className="v3-nav-group-children">{children}</div>}
    </div>
  );
}

interface RecordNavItemProps {
  href: string;
  color: string;
  label: string;
  active?: boolean;
}

function RecordNavItem({ href, color, label, active }: RecordNavItemProps) {
  return (
    <Link href={href} className={`v3-nav-item ${active ? "active" : ""}`}>
      <span className={`v3-record-dot ${color}`} />
      {label}
    </Link>
  );
}

interface NotificationPanelProps {
  onClose: () => void;
}

function NotificationPanel({ onClose }: NotificationPanelProps) {
  return (
    <div className="v3-notification-panel">
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <h2 className="v3-page-header-title">Notifications</h2>
        </div>
        <button className="v3-topbar-btn-icon" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div style={{ padding: "16px" }}>
        <div className="v3-tabs" style={{ padding: 0, borderBottom: "none", gap: 0 }}>
          <button className="v3-tab active">Notifications (0)</button>
          <button className="v3-tab">Requests (0)</button>
        </div>
        <div className="v3-empty-state" style={{ padding: "60px 24px" }}>
          <Bell size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
          <h3>No notifications</h3>
          <p>Notifications and requests from your team will appear here.</p>
        </div>
      </div>
    </div>
  );
}

interface AppShellV3Props {
  user: { userId: string; email: string; name: string | null; avatarUrl: string | null };
  children: ReactNode;
}

export function AppShellV3({ user, children }: AppShellV3Props) {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [demoActive, setDemoActive] = useState(false);

  const isActive = useCallback(
    (path: string) => pathname === path || pathname.startsWith(path + "/"),
    [pathname]
  );

  const initial = (user.name || user.email || "U")[0].toUpperCase();

  return (
    <div className="v3-app">
      {/* Sidebar */}
      <aside className="v3-sidebar">
        {/* Brand */}
        <div className="v3-sidebar-header">
          <div className="v3-sidebar-brand">
            <div className="v3-sidebar-brand-icon">F</div>
            <span>friday</span>
            <ChevronRight size={12} style={{ opacity: 0.4 }} />
          </div>
          <div className="v3-sidebar-actions">
            <button
              className="v3-sidebar-action-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            >
              <Bell size={14} />
            </button>
            <button className="v3-sidebar-action-btn" title="App switcher">
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="v3-sidebar-search">
          <div className="v3-sidebar-search-wrapper">
            <Search className="v3-sidebar-search-icon" />
            <input placeholder="Quick actions" />
            <div className="v3-sidebar-shortcut">
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </div>
          </div>
        </div>

        {/* Main nav */}
        <nav className="v3-nav-section" style={{ flex: 1 }}>
          <NavItem
            href="/v3"
            icon={<Home size={16} />}
            label="Home"
            active={pathname === "/v3"}
          />
          <NavItem
            href="/v3/tasks"
            icon={<CheckSquare size={16} />}
            label="Tasks"
            badge={1}
            active={isActive("/v3/tasks")}
          />
          <NavItem
            href="/v3/emails"
            icon={<Mail size={16} />}
            label="Emails"
            active={isActive("/v3/emails")}
          />
          <Link
            href="/v3/notifications"
            className={`v3-nav-item ${isActive("/v3/notifications") ? "active" : ""}`}
          >
            <span className="v3-nav-item-icon"><MessageCircle size={16} /></span>
            Notifications
            <span style={{
              marginLeft: "auto",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(99,102,241,0.12)",
              color: "var(--v3-accent-indigo)",
              letterSpacing: "0.03em",
              flexShrink: 0,
            }}>iMessage</span>
          </Link>

          {/* Records section */}
          <div className="v3-nav-section-label">Records</div>
          <RecordNavItem
            href="/v3/contacts"
            color="companies"
            label="Companies"
            active={isActive("/v3/contacts")}
          />
          <RecordNavItem
            href="/v3/people"
            color="people"
            label="People"
            active={isActive("/v3/people")}
          />
          <RecordNavItem
            href="/v3/deals"
            color="deals"
            label="Deals"
            active={isActive("/v3/deals")}
          />

          {/* Communication section */}
          <div className="v3-nav-section-label">Communication</div>
          <NavItem
            href="/v3/meetings"
            icon={<Calendar size={16} />}
            label="Meetings"
            active={isActive("/v3/meetings")}
          />
          <NavItem
            href="/v3/notes"
            icon={<FileText size={16} />}
            label="Notes"
            active={isActive("/v3/notes")}
          />

          {/* Automations group */}
          <div className="v3-nav-section-label">Automate</div>
          <NavGroup
            icon={<Play size={16} />}
            label="Sequences & Flows"
            defaultOpen={
              isActive("/v3/sequences") || isActive("/v3/workflows") || isActive("/v3/operator")
            }
          >
            <NavItem
              href="/v3/sequences"
              icon={<Megaphone size={14} />}
              label="Sequences"
              active={isActive("/v3/sequences")}
            />
            <NavItem
              href="/v3/workflows"
              icon={<Workflow size={14} />}
              label="Workflows"
              active={isActive("/v3/workflows")}
            />
            <NavItem
              href="/v3/operator"
              icon={<Monitor size={14} />}
              label="Operator"
              active={isActive("/v3/operator")}
            />
            <NavItem
              href="/v3/lead-finder"
              icon={<Crosshair size={14} />}
              label="Lead Finder"
              active={isActive("/v3/lead-finder")}
            />
          </NavGroup>

          {/* AI Tools section */}
          <div className="v3-nav-section-label">AI Tools</div>
          <NavGroup
            icon={<Brain size={16} />}
            label="Intelligence"
            defaultOpen={
              isActive("/v3/intelligence") ||
              isActive("/v3/watchtower") ||
              isActive("/v3/briefing") ||
              isActive("/v3/reports")
            }
          >
            <NavItem
              href="/v3/intelligence"
              icon={<Brain size={14} />}
              label="Research"
              active={isActive("/v3/intelligence")}
            />
            <NavItem
              href="/v3/watchtower"
              icon={<Eye size={14} />}
              label="Watchtower"
              active={isActive("/v3/watchtower")}
            />
            <NavItem
              href="/v3/briefing"
              icon={<BookOpen size={14} />}
              label="Briefings"
              active={isActive("/v3/briefing")}
            />
            <NavItem
              href="/v3/reports"
              icon={<BarChart2 size={14} />}
              label="Reports"
              active={isActive("/v3/reports")}
            />
          </NavGroup>

          {/* Settings group */}
          <div className="v3-nav-section-label">Settings</div>
          <NavGroup
            icon={<Settings size={16} />}
            label="Configuration"
            defaultOpen={
              isActive("/v3/learning") || isActive("/v3/trust")
            }
          >
            <NavItem
              href="/v3/learning"
              icon={<Sparkles size={14} />}
              label="Learning"
              active={isActive("/v3/learning")}
            />
            <NavItem
              href="/v3/trust"
              icon={<Shield size={14} />}
              label="Trust Rules"
              active={isActive("/v3/trust")}
            />
          </NavGroup>
        </nav>

        {/* Footer */}
        <div className="v3-sidebar-footer">
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
            <DemoModeButton onClick={() => setDemoActive(true)} />
            <button
              title="Help"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
                fontSize: 11, fontWeight: 500, color: "var(--v3-text-ghost, #94a3b8)",
                background: "transparent", border: "1px solid var(--v3-border, rgba(0,0,0,0.08))",
                borderRadius: 6, cursor: "pointer", opacity: 0.6,
              }}
            >
              <HelpCircle size={10} />
              Help
            </button>
          </div>
          <div className="v3-sidebar-invite">
            <UserPlus size={14} />
            <span>Invite team members</span>
          </div>
          <div className="v3-sidebar-trial">
            <div className="v3-avatar v3-avatar-sm" style={{ background: "var(--v3-accent-green)", flexShrink: 0 }}>
              {initial}
            </div>
            <span style={{ fontSize: 12, color: "var(--v3-text-tertiary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name || user.email}
            </span>
            <span style={{ marginLeft: "auto", color: "var(--v3-accent-blue)", fontWeight: 500, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>Pro</span>
          </div>
        </div>
      </aside>

      {/* Notifications overlay */}
      {showNotifications && (
        <NotificationPanel onClose={() => setShowNotifications(false)} />
      )}

      {/* Main content */}
      <main className="v3-main">{children}</main>

      {/* Demo overlay — persists across route changes */}
      {demoActive && (
        <DemoOverlay onStop={() => setDemoActive(false)} />
      )}
    </div>
  );
}
