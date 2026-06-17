"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Zap,
  MessageSquare,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";

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
      {
        href: "/admin/decision-reasons",
        label: "Decision Reasons",
        icon: MessageSquare,
        permission: PERMISSIONS.ADMIN_ROLES,
      },
      {
        href: "/admin/migrate",
        label: "Migration",
        icon: Database,
        permission: PERMISSIONS.ADMIN_USERS,
      },
    ],
  },
];

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "var(--sidebar-w)",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-base)",
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border-base)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-md)",
            background: "var(--brand-500)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={16} color="white" fill="white" />
        </div>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "var(--text-primary)",
              letterSpacing: "-0.3px",
            }}
          >
            OTFlow
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            V3
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
        {NAV_ITEMS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || permissions.includes(item.permission),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  padding: "0 10px",
                  marginBottom: 4,
                }}
              >
                {group.label}
              </div>
              {visibleItems.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{ textDecoration: "none" }}
                  >
                    <div style={{ position: "relative", marginBottom: 2 }}>
                      {active && (
                        <motion.div
                          layoutId="sidebar-active"
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "var(--brand-50)",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--brand-100)",
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 35,
                          }}
                        />
                      )}
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: "var(--radius-sm)",
                          color: active
                            ? "var(--brand-600)"
                            : "var(--text-secondary)",
                          fontWeight: active ? 600 : 400,
                          fontSize: 13.5,
                          transition: "color 0.15s",
                        }}
                        className={cn(
                          !active && "hover:text-[var(--text-primary)]",
                        )}
                      >
                        <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                        {item.label}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom version tag */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border-base)",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        OTFlow V3 · 2025
      </div>
    </aside>
  );
}
