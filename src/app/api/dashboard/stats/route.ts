export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  addWeeks,
  format,
} from "date-fns";

interface AggregateStats {
  totalPending: number | bigint;
  totalApproved: number | bigint;
  totalRejected: number | bigint;
  todayEntries: number | bigint;
  weekEntries: number | bigint;
  lastWeekEntries: number | bigint;
  approvedThisWeek: number | bigint;
  totalApprovedMinutes: number | bigint;
  pendingOldestHours: number | string | bigint | null;
}

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const nextWeekStart = format(
    addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1),
    "yyyy-MM-dd",
  );
  const lastWeekStart = format(
    subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1),
    "yyyy-MM-dd",
  );
  const lastWeekEnd = format(
    endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
  const staleThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Single raw query for all aggregate counts
  const [stats] = await prisma.$queryRaw<AggregateStats[]>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'PENDING')                              AS "totalPending",
      COUNT(*) FILTER (WHERE status = 'APPROVED')                             AS "totalApproved",
      COUNT(*) FILTER (WHERE status = 'REJECTED')                             AS "totalRejected",
      COUNT(*) FILTER (WHERE "workDate" = ${todayStr})                        AS "todayEntries",
      COUNT(*) FILTER (WHERE "workDate" BETWEEN ${weekStart} AND ${weekEnd})  AS "weekEntries",
      COUNT(*) FILTER (WHERE "workDate" BETWEEN ${lastWeekStart} AND ${lastWeekEnd}) AS "lastWeekEntries",
      COUNT(*) FILTER (WHERE status = 'APPROVED' AND "decidedAt" >= ${weekStart}::date AND "decidedAt" < ${nextWeekStart}::date) AS "approvedThisWeek",
      COALESCE(SUM("approvedTotalMinutes") FILTER (WHERE status = 'APPROVED'), 0) AS "totalApprovedMinutes",
      EXTRACT(EPOCH FROM (NOW() - MIN("createdAt") FILTER (WHERE status = 'PENDING'))) / 3600 AS "pendingOldestHours"
    FROM "OtEntry"
  `;

  const [totalEmployees, recentEntries, pendingByDay, pendingQueue, staleCount, topRaw] =
    await Promise.all([
      prisma.employee.count({ where: { isDeleted: false } }),
      prisma.otEntry.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { employee: { select: { name: true, empId: true } } },
      }),
      prisma.otEntry.groupBy({
        by: ["workDate"],
        where: { status: "PENDING", workDate: { gte: weekStart, lte: weekEnd } },
        _count: { _all: true },
        orderBy: { workDate: "asc" },
      }),
      prisma.otEntry.findMany({
        take: 5,
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: { employee: { select: { name: true, empId: true } } },
      }),
      prisma.otEntry.count({
        where: { status: "PENDING", createdAt: { lt: staleThreshold } },
      }),
      prisma.otEntry.groupBy({
        by: ["employeeId"],
        where: { status: "APPROVED", workDate: { gte: weekStart, lte: weekEnd } },
        _sum: { approvedTotalMinutes: true },
        _count: { _all: true },
        orderBy: { _sum: { approvedTotalMinutes: "desc" } },
        take: 5,
      }),
    ]);

  const topEmployeesRaw = await prisma.employee.findMany({
    where: { id: { in: topRaw.map((row) => row.employeeId) } },
    select: { id: true, name: true, empId: true },
  });
  const employeeById = new Map(topEmployeesRaw.map((emp) => [emp.id, emp]));
  const topEmployees = topRaw
    .map((row) => {
      const emp = employeeById.get(row.employeeId);
      return {
        empId: emp?.empId ?? "—",
        name: emp?.name ?? "Unknown employee",
        totalMinutes: row._sum.approvedTotalMinutes ?? 0,
        entries: row._count._all,
      };
    })
    .filter((row) => row.totalMinutes > 0);

  return NextResponse.json({
    totalPending: Number(stats.totalPending),
    totalApproved: Number(stats.totalApproved),
    totalRejected: Number(stats.totalRejected),
    todayEntries: Number(stats.todayEntries),
    weekEntries: Number(stats.weekEntries),
    lastWeekEntries: Number(stats.lastWeekEntries),
    approvedThisWeek: Number(stats.approvedThisWeek),
    totalApprovedMinutes: Number(stats.totalApprovedMinutes),
    pendingOldestHours:
      stats.pendingOldestHours == null
        ? null
        : Number(stats.pendingOldestHours),
    pendingStaleCount: staleCount,
    totalEmployees,
    recentEntries,
    pendingQueue,
    topEmployees,
    pendingByDay,
    weekStart,
    weekEnd,
  });
}
