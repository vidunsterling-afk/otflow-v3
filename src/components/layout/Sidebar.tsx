/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Clock,
  ScrollText,
  CalendarDays,
  Users,
  Shield,
  UserCog,
  Settings,
  MessageSquare,
  LogOut,
  ScanLine,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useSidebarStore } from "@/lib/sidebar-store";
import { Modal } from "@/components/ui/Modal";
import { SessionCountdown } from "@/components/layout/SessionCountdown";
import "./sidebar.css";

const NAV_ITEMS = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        permission: null,
      },
    ],
  },
  {
    label: "Time & Attendance",
    items: [
      {
        href: "/ot-entries",
        label: "OT Entries",
        icon: Clock,
        permission: PERMISSIONS.OT_VIEW,
      },
      {
        href: "/ot-logs",
        label: "OT Logs",
        icon: ScrollText,
        permission: PERMISSIONS.LOGS_VIEW,
      },
      {
        href: "/triple-days",
        label: "Triple Days",
        icon: CalendarDays,
        permission: PERMISSIONS.TRIPLE_DAYS_MANAGE,
      },
      {
        href: "/fingerprint",
        label: "Fingerprint Logs",
        icon: ScanLine,
        permission: PERMISSIONS.OT_CREATE,
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        href: "/admin/decision-reasons",
        label: "Decision Reasons",
        icon: MessageSquare,
        permission: PERMISSIONS.OT_VIEW,
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/admin/employees",
        label: "Employees",
        icon: Users,
        permission: PERMISSIONS.ADMIN_EMPLOYEES,
      },
      {
        href: "/admin/users",
        label: "Users",
        icon: UserCog,
        permission: PERMISSIONS.ADMIN_USERS,
      },
      {
        href: "/admin/roles",
        label: "Roles",
        icon: Shield,
        permission: PERMISSIONS.ADMIN_ROLES,
      },
      {
        href: "/admin/audit",
        label: "Audit Trail",
        icon: Settings,
        permission: PERMISSIONS.ADMIN_AUDIT,
      },
    ],
  },
];

function NavGroup({
  group,
  permissions,
  pathname,
}: {
  group: (typeof NAV_ITEMS)[0];
  permissions: string[];
  pathname: string;
}) {
  const visibleItems = group.items.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );

  if (visibleItems.length === 0) return null;

  return (
    <div className="sidebar-group">
      <div className="sidebar-group__label">{group.label}</div>
      {visibleItems.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="sidebar-link"
            data-active={active}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active"
                className="sidebar-link__bg"
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 35,
                }}
              />
            )}
            <motion.span
              className="sidebar-link__icon"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.15 }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
            </motion.span>
            <span className="sidebar-link__label">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

interface SidebarProps {
  permissions: string[];
  user: {
    username?: string | null;
    name?: string | null;
    roleName?: string | null;
  };
}

export function Sidebar({ permissions, user }: SidebarProps) {
  const { logo, companyName, isLoading } = useCompanySettings();
  const pathname = usePathname();
  const { mobileOpen, toggleMobile, closeMobile } = useSidebarStore();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const displayName = user.username ?? user.name ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, closeMobile]);

  return (
    <>
      <button
        className="sidebar-hamburger"
        data-open={mobileOpen}
        onClick={toggleMobile}
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>

      <div
        className="sidebar-backdrop"
        data-open={mobileOpen}
        onClick={closeMobile}
        aria-hidden="true"
      />

      <aside
        className="sidebar"
        data-mobile-open={mobileOpen}
        aria-label="Main navigation"
      >
        <div className="sidebar-header">
          <div className="sidebar-logo" data-has-logo={Boolean(logo)}>
            {isLoading ? (
              <Loader2 size={18} color="#fff" className="animate-spin" />
            ) : logo ? (
              <img src={logo} alt={companyName || "Company logo"} />
            ) : (
              <Clock size={19} color="#fff" fill="#fff" />
            )}
          </div>
          <div className="sidebar-brand">
            <div className="sidebar-brand__name">OTFlow</div>
            <div className="sidebar-brand__sub">Overtime Management</div>
          </div>
          <button
            className="sidebar-mobile-close"
            onClick={closeMobile}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((group) => (
            <NavGroup
              key={group.label}
              group={group}
              permissions={permissions}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* Session status — stays mounted so warnings and auto sign-out keep working */}
        <div className="sidebar-session">
          <div className="sidebar-session__row">
            <Shield size={13} className="sidebar-session__icon" />
            <span className="sidebar-session__label">Session</span>
            <SessionCountdown pill />
          </div>
        </div>

        {/* User profile + logout — styled like the rest of the sidebar */}
        <div className="sidebar-user">
          <button
            className="sidebar-user__button"
            onClick={() => setLogoutOpen(true)}
            aria-label={`Signed in as ${displayName}. Sign out`}
          >
            <span className="sidebar-user__avatar">{initials}</span>
            <span className="sidebar-user__info">
              <span className="sidebar-user__name">{displayName}</span>
              <span className="sidebar-user__role">
                {user.roleName ?? "—"}
              </span>
            </span>
            <LogOut size={15} className="sidebar-user__logout" />
          </button>
        </div>

        <div className="sidebar-footer">
          <span>OTFlow V3</span>
          <span className="sidebar-footer__version">
            © {new Date().getFullYear()}
          </span>
        </div>
      </aside>

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Sign out?"
        subtitle="You'll be returned to the login screen."
        width={420}
      >
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          Are you sure you want to sign out of OTFlow? Any unsaved changes will
          be lost.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            onClick={() => setLogoutOpen(false)}
            style={{
              padding: "9px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-base)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              padding: "9px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--status-rejected-border)",
              background: "var(--status-rejected-bg)",
              color: "var(--status-rejected-text)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </Modal>
    </>
  );
}
