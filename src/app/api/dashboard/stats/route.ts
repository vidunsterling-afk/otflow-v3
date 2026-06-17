export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [
    totalPending,
    totalApproved,
    totalRejected,
    todayEntries,
    weekEntries,
    totalEmployees,
    recentEntries,
    pendingByDay,
  ] = await Promise.all([
    prisma.otEntry.count({ where: { status: "PENDING" } }),
    prisma.otEntry.count({ where: { status: "APPROVED" } }),
    prisma.otEntry.count({ where: { status: "REJECTED" } }),
    prisma.otEntry.count({ where: { workDate: todayStr } }),
    prisma.otEntry.count({
      where: { workDate: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.employee.count({ where: { isDeleted: false } }),
    prisma.otEntry.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { employee: { select: { name: true, empId: true } } },
    }),
    prisma.otEntry.groupBy({
      by: ["workDate"],
      where: {
        status: "PENDING",
        workDate: { gte: weekStart, lte: weekEnd },
      },
      _count: { _all: true },
      orderBy: { workDate: "asc" },
    }),
  ]);

  const approvedMinutes = await prisma.otEntry.aggregate({
    where: { status: "APPROVED" },
    _sum: { approvedTotalMinutes: true },
  });

  return NextResponse.json({
    totalPending,
    totalApproved,
    totalRejected,
    todayEntries,
    weekEntries,
    totalEmployees,
    totalApprovedMinutes: approvedMinutes._sum.approvedTotalMinutes ?? 0,
    recentEntries,
    pendingByDay,
    weekStart,
    weekEnd,
  });
}
