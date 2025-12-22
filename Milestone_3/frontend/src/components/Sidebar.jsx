/**
 * Sidebar.jsx - Navigation sidebar with collapsible menu
 */

import { useState } from "react";

// Icon components
function IconDashboard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconPredict() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Crystal ball / magic prediction icon */}
      <circle cx="12" cy="10" r="7" />
      <path d="M12 17v4" strokeLinecap="round" />
      <path d="M8 21h8" strokeLinecap="round" />
      <path d="M9 8l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16,17 21,12 16,7" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron({ collapsed }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.3s ease"
      }}
    >
      <polyline points="15,18 9,12 15,6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {/* Q Shape: Circle + Tail */}
      <path
        d="M12 21a9 9 0 1 1 9-9c0 1.1-.18 2.15-.5 3.12M17 17l4 4"
        stroke="url(#sidebarBrandGrad)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rising Chart Line inside */}
      <path
        d="M8 12l2.5 2.5 5.5-5.5"
        stroke="url(#sidebarBrandGrad)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="sidebarBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconInsights() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" strokeLinecap="round" />
      <path d="M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconCompare() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </svg>
  );
}

function IconSimulator() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2v4" strokeLinecap="round" />
      <path d="M12 18v4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="6" />
      <path d="M12 9v6" strokeLinecap="round" />
      <path d="M9 12h6" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: IconDashboard },
  { id: "predict", label: "Predict", icon: IconPredict },
  { id: "compare", label: "Compare", icon: IconCompare },
  { id: "simulator", label: "Simulator", icon: IconSimulator },
  { id: "history", label: "History", icon: IconHistory },
  { id: "insights", label: "Model Insights", icon: IconInsights },
];

export default function Sidebar({ activeSection, onSectionChange, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* Logo / Brand */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <IconChart />
          {!collapsed && <span className="sidebar-brand">Quantara</span>}
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconChevron collapsed={collapsed} />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              onClick={() => onSectionChange(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <Icon />
              {!collapsed && <span>{item.label}</span>}
              {isActive && <div className="active-indicator" />}
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="sidebar-footer">
        {!collapsed && user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user.picture ? (
                <img src={user.picture} alt={user.name || "User"} />
              ) : (
                <span>{(user.name || user.email || "U")[0].toUpperCase()}</span>
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name || "User"}</span>
              <span className="sidebar-user-email">{user.email}</span>
            </div>
          </div>
        )}
        <button
          className="sidebar-logout"
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
        >
          <IconLogout />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
