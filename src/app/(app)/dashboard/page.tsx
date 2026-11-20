"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Info,
  ListChecks,
  Shield,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatMinutes } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import { DashboardStats } from "@/lib/statsInterface";
import "./dashboard.css";

function hoursSince(iso?: string): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function waitText(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m waiting`;
  if (hours < 24) return `${Math.floor(hours)}h waiting`;
  return `${Math.floor(hours / 24)}d waiting`;
}

function FlowStep({
  num,
  title,
  desc,
  value,
  href,
}: {
  num: number;
  title: string;
  desc: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="dash-flow__num">{num}</span>
      <span className="dash-flow__body">
        <span className="dash-flow__title" style={{ display: "block" }}>
          {title}
        </span>
        <span className="dash-flow__desc" style={{ display: "block" }}>
          {desc}
        </span>
      </span>
      <span className="dash-flow__value">{value}</span>
    </>
  );

  if (!href) return <div className="dash-flow__step">{content}</div>;

  return (
    <Link href={href} className="dash-flow__step">
      {content}
      <ChevronRight size={14} color="var(--text-muted)" />
    </Link>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as
    | {
        username?: string | null;
        name?: string | null;
        roleName?: string | null;
        permissions?: string[];
      }
    | undefined;

  const permissions: string[] = user?.permissions ?? [];
  const canApprove = permissions.includes(PERMISSIONS.OT_APPROVE);
  const canViewEntries = permissions.includes(PERMISSIONS.OT_VIEW);
  const canViewLogs = permissions.includes(PERMISSIONS.LOGS_VIEW);

  const [queueTab, setQueueTab] = useState<"pending" | "recent">(
    canApprove ? "pending" : "recent",
  );

  const { data, isLoading, dataUpdatedAt } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/dashboard/stats").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: health } = useQuery<{ status: string; db: string }>({
    queryKey: ["db-health"],
    queryFn: () =>
      fetch("/api/health/db")
        .then((r) => r.json())
        .catch(() => ({ status: "error", db: "disconnected" })),
    refetchInterval: 60_000,
    retry: false,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (!data) return null;

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const displayName = user?.username ?? user?.name ?? "there";

  const weekChange =
    data.lastWeekEntries > 0
      ? Math.round(
          ((data.weekEntries - data.lastWeekEntries) / data.lastWeekEntries) *
            100,
        )
      : null;

  const queueItems =
    queueTab === "pending" ? data.pendingQueue : data.recentEntries;
  const maxTop = Math.max(...data.topEmployees.map((e) => e.totalMinutes), 1);

  return (
    <div className="dash">
      {/* Greeting */}
      <div className="dash-heading">
        <div>
          <div className="dash-heading__eyebrow">
            {format(now, "EEEE, d MMMM yyyy")}
          </div>
          <h1 className="dash-heading__title">
            {greeting}, {displayName}
          </h1>
          <p className="dash-heading__sub">
            Here&apos;s what&apos;s happening across OTFlow right now.
          </p>
        </div>
      </div>

      {/* System strip */}
      <div className="dash-system">
        <span className="dash-system__item">
          <span
            className="dash-system__dot"
            data-error={health?.db !== "connected"}
          />
          Database <strong>{health?.db ?? "checking…"}</strong>
        </span>
        <span className="dash-system__item">
          <Database size={13} /> Auto-refresh every 30s
        </span>
        <span className="dash-system__item">
          <Clock size={13} /> Last sync{" "}
          <strong>{format(new Date(dataUpdatedAt), "HH:mm:ss")}</strong>
        </span>
        <span className="dash-system__item">
          <Shield size={13} /> OTFlow V3
        </span>
        <span className="dash-system__item dash-system__hint">
          <Info size={13} /> OT minutes are rounded down to the nearest 15
        </span>
      </div>

      {/* Priority banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`dash-priority ${
          data.totalPending === 0
            ? "dash-priority--clear"
            : canApprove
              ? ""
              : "dash-priority--info"
        }`}
      >
        <div className="dash-priority__icon">
          {data.totalPending === 0 ? (
            <CheckCircle2 size={20} />
          ) : canApprove ? (
            <AlertTriangle size={20} />
          ) : (
            <Info size={20} />
          )}
        </div>
        <div className="dash-priority__body">
          <div className="dash-priority__title">
            {data.totalPending === 0
              ? "You're all caught up"
              : canApprove
                ? `${data.totalPending} ${data.totalPending === 1 ? "entry" : "entries"} need your decision`
                : `${data.totalPending} ${data.totalPending === 1 ? "entry is" : "entries are"} pending with management`}
          </div>
          <div className="dash-priority__desc">
            {data.totalPending === 0
              ? "No pending approvals right now. New submissions will show up here."
              : `Oldest waiting ${waitText(data.pendingOldestHours)}${
                  data.pendingStaleCount > 0
                    ? ` · ${data.pendingStaleCount} older than 2 days`
                    : ""
                }`}
          </div>
        </div>
        <Link
          href={canViewEntries || canApprove ? "/ot-entries" : "/ot-logs"}
          className="dash-priority__action"
        >
          {data.totalPending === 0
            ? "View entries"
            : canApprove
              ? "Review now"
              : "View status"}
          <ArrowRight size={15} />
        </Link>
      </motion.div>

      {/* Stat cards */}
      <div className="dash-stats">
        <Link href="/ot-entries" className="dash-feature">
          <div className="dash-feature__top">
            <span className="dash-feature__label">Pending approvals</span>
            <span className="dash-feature__icon">
              <Clock size={18} color="#fff" />
            </span>
          </div>
          <div>
            <div className="dash-feature__value">{data.totalPending}</div>
            <div className="dash-feature__sub">
              {data.pendingStaleCount > 0
                ? `${data.pendingStaleCount} waiting over 2 days`
                : "Awaiting a decision"}
            </div>
          </div>
        </Link>

        <StatCard
          label="Approved OT"
          value={formatMinutes(data.totalApprovedMinutes)}
          sub="All time"
          icon={Timer}
          iconColor="var(--brand-600)"
          iconBg="var(--brand-50)"
          delay={0.05}
        />
        <StatCard
          label="This week"
          value={data.weekEntries}
          sub={
            weekChange === null
              ? "First tracked week"
              : `${weekChange > 0 ? "+" : ""}${weekChange}% vs last week`
          }
          icon={CalendarDays}
          delay={0.1}
        />
        <StatCard
          label="Approved this week"
          value={data.approvedThisWeek}
          sub="Decisions made"
          icon={CheckCircle2}
          iconColor="var(--status-approved-text)"
          iconBg="var(--status-approved-bg)"
          delay={0.15}
        />
        <StatCard
          label="Active employees"
          value={data.totalEmployees}
          sub="On record"
          icon={Users}
          delay={0.2}
        />
      </div>

      {/* Main grid */}
      <div className="dash-grid">
        <div className="dash-main">
          <div className="dash-card">
            <SectionHeader
              title={
                queueTab === "pending" ? "Action queue" : "Recent activity"
              }
              sub={
                queueTab === "pending"
                  ? "Oldest pending submissions first"
                  : "Latest entries across the team"
              }
              icon={queueTab === "pending" ? ListChecks : Activity}
              action={
                <div className="dash-tabs">
                  <button
                    className="dash-tab"
                    data-active={queueTab === "pending"}
                    onClick={() => setQueueTab("pending")}
                  >
                    Pending
                  </button>
                  <button
                    className="dash-tab"
                    data-active={queueTab === "recent"}
                    onClick={() => setQueueTab("recent")}
                  >
                    Recent
                  </button>
                </div>
              }
            />

            <div className="dash-queue__list">
              {queueItems.length === 0 && (
                <div className="dash-queue__empty">
                  <CheckCircle2 size={24} color="var(--text-muted)" />
                  Nothing here right now
                </div>
              )}
              {queueItems.map((entry, index) => {
                const wait = hoursSince(entry.createdAt);
                return (
                  <motion.div
                    key={entry.id}
                    className="dash-queue__item"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.035 }}
                  >
                    <div className="dash-queue__avatar">
                      {entry.employee.empId}
                    </div>
                    <div className="dash-queue__info">
                      <div className="dash-queue__name">
                        {entry.employee.name}
                      </div>
                      <div className="dash-queue__meta">
                        {formatDate(entry.workDate)} · {entry.shift}
                      </div>
                    </div>
                    <div className="dash-queue__right">
                      <span className="dash-hours">
                        {formatMinutes(
                          entry.status === "APPROVED"
                            ? entry.approvedTotalMinutes
                            : entry.normalMinutes + entry.approvedTotalMinutes,
                        )}
                      </span>
                      {queueTab === "pending" && (
                        <span
                          className="dash-wait"
                          data-stale={wait !== null && wait >= 48}
                        >
                          {waitText(wait)}
                        </span>
                      )}
                      <StatusBadge status={entry.status} iconOnly />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <Link href="/ot-entries" className="dash-card__link">
              View all entries <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="dash-side">
          {/* Workflow */}
          <div className="dash-card">
            <SectionHeader
              title="How it works"
              sub="Your workflow at a glance"
              icon={Zap}
            />
            <div className="dash-flow">
              <FlowStep
                num={1}
                title="Submit OT"
                desc="Managers log overtime entries"
                value={String(data.weekEntries)}
                href={canViewEntries ? "/ot-entries" : undefined}
              />
              <FlowStep
                num={2}
                title="Review & decide"
                desc="Approve or reject submissions"
                value={String(data.totalPending)}
                href={canApprove ? "/ot-entries" : undefined}
              />
              <FlowStep
                num={3}
                title="Export for payroll"
                desc="Generate branded reports"
                value={formatMinutes(data.totalApprovedMinutes)}
                href={canViewLogs ? "/ot-logs" : undefined}
              />
            </div>
          </div>

          {/* Top employees */}
          {data.topEmployees.length > 0 && (
            <div className="dash-card">
              <SectionHeader
                title="Top OT this week"
                sub="Approved hours by employee"
                icon={Users}
              />
              <div className="dash-top">
                {data.topEmployees.map((emp, i) => (
                  <div key={emp.empId} className="dash-top__row">
                    <span className="dash-top__rank">{i + 1}</span>
                    <div className="dash-top__body">
                      <div className="dash-top__name">{emp.name}</div>
                      <div className="dash-top__bar">
                        <div
                          className="dash-top__fill"
                          style={{
                            width: `${(emp.totalMinutes / maxTop) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="dash-top__hours">
                      {formatMinutes(emp.totalMinutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dash-skeleton">
      <div>
        <div
          className="dash-skeleton__bar"
          style={{ width: 180, height: 14 }}
        />
        <div
          className="dash-skeleton__bar"
          style={{ width: 260, height: 28, marginTop: 12 }}
        />
        <div
          className="dash-skeleton__bar"
          style={{ width: 300, height: 14, marginTop: 10 }}
        />
      </div>
      <div
        className="dash-skeleton__bar"
        style={{ width: "100%", height: 82 }}
      />
      <div className="dash-stats">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="dash-skeleton__bar" style={{ height: 132 }} />
        ))}
      </div>
      <div className="dash-grid">
        <div className="dash-skeleton__bar" style={{ height: 380 }} />
        <div className="dash-skeleton__bar" style={{ height: 380 }} />
      </div>
    </div>
  );
}
