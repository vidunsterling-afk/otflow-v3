/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Database,
  ScanLine,
  Loader2,
  X,
} from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";
import { useState, useEffect } from "react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useSidebarStore } from "@/lib/sidebar-store";
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
    <div className="sidebar-dev">
      {state === "idle" ? (
        <motion.button
          className="sidebar-dev-btn"
          onClick={handleClick}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15 }}
        >
          <Database size={14} strokeWidth={1.8} />
          Migration Tool
        </motion.button>
      ) : (
        <div className="sidebar-dev-panel" data-error={error}>
          <div className="sidebar-dev-label">Dev password</div>
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
            className="sidebar-dev-input"
            aria-label="Developer migration password"
          />
          {error && <div className="sidebar-dev-error">Incorrect password</div>}
          <div className="sidebar-dev-actions">
            <motion.button
              className="sidebar-dev-submit"
              onClick={handleSubmit}
              whileTap={{ scale: 0.96 }}
            >
              Enter
            </motion.button>
            <motion.button
              className="sidebar-dev-cancel"
              onClick={() => {
                setState("idle");
                setError(false);
              }}
              whileTap={{ scale: 0.96 }}
            >
              Cancel
            </motion.button>
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

export function Sidebar({ permissions }: { permissions: string[] }) {
  const { logo, companyName, isLoading } = useCompanySettings();
  const pathname = usePathname();
  const { mobileOpen, closeMobile } = useSidebarStore();

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

        <DevMigrationButton />

        <div className="sidebar-footer">
          <span>OTFlow V3</span>
          <span className="sidebar-footer__version">
            © {new Date().getFullYear()}
          </span>
        </div>
      </aside>
    </>
  );
}
