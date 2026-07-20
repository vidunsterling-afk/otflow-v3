/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  Database,
  ScanLine,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import { useState, useEffect } from "react";
import { useCompanySettings } from "@/hooks/useCompanySettings";

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
      {
        href: "/admin/decision-reasons",
        label: "Decision Reasons",
        icon: MessageSquare,
        permission: PERMISSIONS.OT_VIEW,
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

const DEV_PASSWORD = "otflow-dev";

function DevMigrationButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "prompt">("idle");
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function handleClick() {
    setState("prompt");
    setInput("");
    setError(false);
  }

  function handleSubmit() {
    if (input === DEV_PASSWORD) {
      setState("idle");
      router.push("/admin/migrate");
    } else {
      setError(true);
      setInput("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") {
      setState("idle");
      setError(false);
    }
  }

  return (
    <div
      style={{
        padding: "10px 12px",
        borderTop: "1px solid var(--border-base)",
      }}
    >
      {state === "idle" ? (
        <button
          onClick={handleClick}
          title="Developer Migration Tool"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "1px dashed var(--border-base)",
            borderRadius: "var(--radius-sm)",
            padding: "7px 10px",
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: 12,
            transition: "all 0.15s",
          }}
          className="hover:border-(--brand-300) hover:text-(--brand-500)"
        >
          <Database size={13} strokeWidth={1.8} />
          Migration Tool
        </button>
      ) : (
        <div
          style={{
            background: "var(--bg-card)",
            border: `1px solid ${error ? "var(--red-300, #fca5a5)" : "var(--border-base)"}`,
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            Dev password
          </div>
          <input
            autoFocus
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter password..."
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 12,
              color: "var(--text-primary)",
              width: "100%",
            }}
          />
          {error && (
            <div style={{ fontSize: 11, color: "var(--red-500, #ef4444)" }}>
              Incorrect password
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                background: "var(--brand-500)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs, 4px)",
                padding: "4px 0",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Enter
            </button>
            <button
              onClick={() => {
                setState("idle");
                setError(false);
              }}
              style={{
                flex: 1,
                background: "var(--bg-hover, #f1f5f9)",
                color: "var(--text-secondary)",
                border: "none",
                borderRadius: "var(--radius-xs, 4px)",
                padding: "4px 0",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavGroup({
  group,
  permissions,
  pathname,
  defaultOpen,
}: {
  group: (typeof NAV_ITEMS)[0];
  permissions: string[];
  pathname: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Keep expanded if active route is inside this group
  const hasActive = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  const visibleItems = group.items.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );

  if (visibleItems.length === 0) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Group header */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "6px 10px",
          borderRadius: "var(--radius-sm)",
          marginBottom: 2,
        }}
        className="hover:bg-(--bg-hover,#f1f5f9)"
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.8px",
            textTransform: "uppercase",
          }}
        >
          {group.label}
        </span>
        <motion.div
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={12} color="var(--text-muted)" />
        </motion.div>
      </button>

      {/* Items */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {visibleItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
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
                      className={cn(!active && "hover:text-(--text-primary)")}
                    >
                      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                      {item.label}
                    </div>
                  </div>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar({ permissions }: { permissions: string[] }) {
  const { logo, companyName, isLoading } = useCompanySettings();
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
            background: logo ? "white" : "var(--brand-500)",
            border: logo ? "1px solid var(--border-base)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isLoading ? (
            <Clock size={18} color="white" />
          ) : logo ? (
            <img
              src={logo}
              alt={companyName}
              style={{ height: 28, maxWidth: 34, objectFit: "contain" }}
            />
          ) : (
            <Zap size={16} color="white" fill="white" />
          )}
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
            Overtime Management
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
        {NAV_ITEMS.map((group, i) => (
          <NavGroup
            key={group.label}
            group={group}
            permissions={permissions}
            pathname={pathname}
            defaultOpen={i === 0} // Overview open by default
          />
        ))}
      </nav>

      {/* Dev Migration Tool */}
      <DevMigrationButton />

      {/* Footer */}
      <div
        style={{
          padding: "10px 20px",
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
