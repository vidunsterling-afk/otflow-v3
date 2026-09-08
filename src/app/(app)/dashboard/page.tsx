"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  CalendarDays,
  Timer,
  Activity,
  TrendingUp,
  LayoutDashboard,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatMinutes, formatDate } from "@/lib/utils";
import Link from "next/link";
import { DashboardStats } from "@/lib/statsInterface";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetch("/api/dashboard/stats").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (!data) return null;

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Page header */}
      <AdminPageHeader
        title="Dashboard"
        sub="Track and manage overtime activity across your team"
        icon={LayoutDashboard}
      />

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        <StatCard
          label="Pending Approvals"
          value={data.totalPending}
          sub="Awaiting decision"
          icon={Clock}
          iconColor="var(--status-pending-text)"
          iconBg="var(--status-pending-bg)"
          delay={0}
        />
        <StatCard
          label="Approved Entries"
          value={data.totalApproved}
          sub="All time"
          icon={CheckCircle2}
          iconColor="var(--status-approved-text)"
          iconBg="var(--status-approved-bg)"
          delay={0.05}
        />
        <StatCard
          label="Rejected Entries"
          value={data.totalRejected}
          sub="All time"
          icon={XCircle}
          iconColor="var(--status-rejected-text)"
          iconBg="var(--status-rejected-bg)"
          delay={0.1}
        />
        <StatCard
          label="Total Employees"
          value={data.totalEmployees}
          sub="Active"
          icon={Users}
          delay={0.15}
        />
        <StatCard
          label="Today's Entries"
          value={data.todayEntries}
          sub="Submitted today"
          icon={CalendarDays}
          iconColor="var(--brand-500)"
          iconBg="var(--brand-50)"
          delay={0.2}
        />
        <StatCard
          label="Approved OT"
          value={formatMinutes(data.totalApprovedMinutes)}
          sub="Total hours approved"
          icon={Timer}
          iconColor="var(--brand-600)"
          iconBg="var(--brand-50)"
          delay={0.25}
        />
      </div>

      {/* Bottom grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Recent entries */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-lg)",
            padding: 28,
            boxShadow: "var(--shadow-card)",
          }}
        >
          <SectionHeader
            title="Recent OT Entries"
            sub="Latest submissions"
            icon={Activity}
            action={
              <Link
                href="/ot-entries"
                style={{
                  fontSize: 12.5,
                  color: "var(--brand-500)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                View all →
              </Link>
            }
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginTop: 8,
            }}
          >
            {data.recentEntries.length === 0 && (
              <div
                style={{
                  padding: "48px 0",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No entries yet
              </div>
            )}
            {data.recentEntries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.04 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 12px",
                  borderRadius: "var(--radius-sm)",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "var(--bg-muted)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "transparent")
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    {entry.employee.empId}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {entry.employee.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {formatDate(entry.workDate)} · {entry.shift}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      fontWeight: 500,
                    }}
                  >
                    {formatMinutes(
                      entry.status === "APPROVED"
                        ? entry.approvedTotalMinutes
                        : entry.normalMinutes + entry.approvedTotalMinutes,
                    )}
                  </div>
                  <StatusBadge status={entry.status} iconOnly />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* This week pending by day */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.35 }}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <SectionHeader
              title="This Week"
              sub={`Pending by day`}
              icon={TrendingUp}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 8,
              }}
            >
              {DAYS.map((day, i) => {
                const dateStr = getWeekDateStr(data.weekStart, i);
                const entry = data.pendingByDay.find(
                  (p) => p.workDate === dateStr,
                );
                const count = entry?._count._all ?? 0;
                const max = Math.max(
                  ...data.pendingByDay.map((p) => p._count._all),
                  1,
                );
                const pct = (count / max) * 100;

                return (
                  <div
                    key={day}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {day}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 7,
                        background: "var(--bg-muted)",
                        borderRadius: 99,
                        overflow: "hidden",
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }}
                        style={{
                          height: "100%",
                          background:
                            count > 0 ? "var(--brand-400)" : "transparent",
                          borderRadius: 99,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: 18,
                        fontSize: 12,
                        fontWeight: 600,
                        color:
                          count > 0
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Quick stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.4 }}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <SectionHeader title="Quick Stats" icon={Timer} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginTop: 8,
              }}
            >
              {[
                { label: "Entries this week", value: data.weekEntries },
                { label: "Entries today", value: data.todayEntries },
                {
                  label: "Approval rate",
                  value:
                    data.totalApproved + data.totalRejected === 0
                      ? "—"
                      : `${Math.round(
                          (data.totalApproved /
                            (data.totalApproved + data.totalRejected)) *
                            100,
                        )}%`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border-base)",
                  }}
                >
                  <span
                    style={{ fontSize: 13, color: "var(--text-secondary)" }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function getWeekDateStr(weekStart: string, dayOffset: number): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().split("T")[0];
}

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <div
          style={{
            width: 160,
            height: 26,
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-muted)",
          }}
        />
        <div
          style={{
            width: 220,
            height: 15,
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-muted)",
            marginTop: 8,
          }}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 100,
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-muted)",
              animation: "pulse 1.5s infinite",
            }}
          />
        ))}
      </div>
    </div>
  );
}
