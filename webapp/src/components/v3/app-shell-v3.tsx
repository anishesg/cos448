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
  Phone,
  BarChart3,
  ChevronRight,
  Play,
  Workflow,
  Building2,
  Users,
  Handshake,
  User,
  Boxes,
  Search,
  LayoutGrid,
  Settings,
  UserPlus,
  BookOpen,
  Shield,
  Eye,
  Calendar,
  Megaphone,
  Monitor,
  Brain,
  Sparkles,
  TestTube,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

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
          <h3>No requests</h3>
          <p>Requests from other users will be displayed here.</p>
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
            <button className="v3-sidebar-action-btn">
              <LayoutGrid size={14} />
            </button>
            <button className="v3-sidebar-action-btn">
              <Search size={14} />
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
            href="/v3/notifications"
            icon={<Bell size={16} />}
            label="Notifications"
            active={isActive("/v3/notifications")}
          />
          <NavItem
            href="/v3/tasks"
            icon={<CheckSquare size={16} />}
            label="Tasks"
            badge={1}
            active={isActive("/v3/tasks")}
          />
          <NavItem
            href="/v3/notes"
            icon={<FileText size={16} />}
            label="Notes"
            active={isActive("/v3/notes")}
          />
          <NavItem
            href="/v3/emails"
            icon={<Mail size={16} />}
            label="Emails"
            active={isActive("/v3/emails")}
          />
          <NavItem
            href="/v3/calls"
            icon={<Phone size={16} />}
            label="Calls"
            active={isActive("/v3/calls")}
          />
          <NavItem
            href="/v3/reports"
            icon={<BarChart3 size={16} />}
            label="Reports"
            active={isActive("/v3/reports")}
          />

          {/* Automations group */}
          <NavGroup
            icon={<Play size={16} />}
            label="Automations"
            defaultOpen={
              isActive("/v3/sequences") || isActive("/v3/workflows")
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
          </NavGroup>

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

          {/* AI Tools section */}
          <div className="v3-nav-section-label">AI Tools</div>
          <NavItem
            href="/v3/intelligence"
            icon={<Brain size={16} />}
            label="Intelligence"
            active={isActive("/v3/intelligence")}
          />
          <NavItem
            href="/v3/briefing"
            icon={<BookOpen size={16} />}
            label="Briefings"
            active={isActive("/v3/briefing")}
          />
          <NavItem
            href="/v3/watchtower"
            icon={<Eye size={16} />}
            label="Watchtower"
            active={isActive("/v3/watchtower")}
          />
          <NavItem
            href="/v3/meetings"
            icon={<Calendar size={16} />}
            label="Meetings"
            active={isActive("/v3/meetings")}
          />
          <NavItem
            href="/v3/operator"
            icon={<Monitor size={16} />}
            label="Operator"
            active={isActive("/v3/operator")}
          />
          <NavItem
            href="/v3/learning"
            icon={<Sparkles size={16} />}
            label="Learning"
            active={isActive("/v3/learning")}
          />
          <NavItem
            href="/v3/trust"
            icon={<Shield size={16} />}
            label="Trust Rules"
            active={isActive("/v3/trust")}
          />
          <NavItem
            href="/v3/test"
            icon={<TestTube size={16} />}
            label="Test Lab"
            active={isActive("/v3/test")}
          />
        </nav>

        {/* Footer */}
        <div className="v3-sidebar-footer">
          <div className="v3-sidebar-invite">
            <UserPlus size={14} />
            <span>Invite team members</span>
          </div>
          <div className="v3-sidebar-trial">
            <span>14 days left on trial</span>
            <span style={{ marginLeft: "auto", color: "var(--v3-accent-indigo)", fontWeight: 500, cursor: "pointer" }}>Keep Pro</span>
          </div>
        </div>
      </aside>

      {/* Notifications overlay */}
      {showNotifications && (
        <NotificationPanel onClose={() => setShowNotifications(false)} />
      )}

      {/* Main content */}
      <main className="v3-main">{children}</main>
    </div>
  );
}
