export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  // Single raw query replaces 8 parallel Prisma calls
  const [stats]: any[] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE status = 'PENDING')                              AS "totalPending",
      COUNT(*) FILTER (WHERE status = 'APPROVED')                             AS "totalApproved",
      COUNT(*) FILTER (WHERE status = 'REJECTED')                             AS "totalRejected",
      COUNT(*) FILTER (WHERE "workDate" = ${todayStr})                        AS "todayEntries",
      COUNT(*) FILTER (WHERE "workDate" BETWEEN ${weekStart} AND ${weekEnd})  AS "weekEntries",
      COALESCE(SUM("approvedTotalMinutes") FILTER (WHERE status = 'APPROVED'), 0) AS "totalApprovedMinutes"
    FROM "OtEntry"
  `;

  // These two still need separate queries but are lightweight
  const [totalEmployees, recentEntries, pendingByDay] = await Promise.all([
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
  ]);

  return NextResponse.json({
    totalPending: Number(stats.totalPending),
    totalApproved: Number(stats.totalApproved),
    totalRejected: Number(stats.totalRejected),
    todayEntries: Number(stats.todayEntries),
    weekEntries: Number(stats.weekEntries),
    totalApprovedMinutes: Number(stats.totalApprovedMinutes),
    totalEmployees,
    recentEntries,
    pendingByDay,
    weekStart,
    weekEnd,
  });
}
