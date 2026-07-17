/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "week";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status") ?? "ALL";
  const employeeId = searchParams.get("employeeId") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50");

  const now = new Date();
  let dateFrom: string;
  let dateTo: string;

  if (range === "custom" && from && to) {
    dateFrom = from;
    dateTo = to;
  } else if (range === "day") {
    dateFrom = dateTo = from ? from : format(now, "yyyy-MM-dd");
  } else if (range === "week") {
    dateFrom = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    dateTo = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  } else if (range === "month") {
    dateFrom = format(startOfMonth(now), "yyyy-MM-dd");
    dateTo = format(endOfMonth(now), "yyyy-MM-dd");
  } else if (range === "year") {
    dateFrom = format(startOfYear(now), "yyyy-MM-dd");
    dateTo = format(endOfYear(now), "yyyy-MM-dd");
  } else {
    dateFrom = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    dateTo = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  }

  const where: any = {
    workDate: { gte: dateFrom, lte: dateTo },
  };
  if (status !== "ALL") where.status = status;
  if (employeeId) where.employeeId = employeeId;

  const [entries, total, aggregates] = await Promise.all([
    prisma.otEntry.findMany({
      where,
      include: {
        employee: { select: { name: true, empId: true } },
        decidedBy: { select: { username: true } },
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.otEntry.count({ where }),
    prisma.otEntry.aggregate({
      where,
      _sum: {
        normalMinutes: true,
        doubleMinutes: true,
        tripleMinutes: true,
        approvedTotalMinutes: true,
      },
      _count: { _all: true },
    }),
  ]);

  const statusCounts = await prisma.otEntry.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  return NextResponse.json({
    entries,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    dateFrom,
    dateTo,
    aggregates: {
      totalNormalMinutes: aggregates._sum.normalMinutes ?? 0,
      totalDoubleMinutes: aggregates._sum.doubleMinutes ?? 0,
      totalTripleMinutes: aggregates._sum.tripleMinutes ?? 0,
      totalApprovedMinutes: aggregates._sum.approvedTotalMinutes ?? 0,
      totalEntries: aggregates._count._all,
    },
    statusCounts: statusCounts.reduce(
      (acc, s) => {
        acc[s.status] = s._count._all;
        return acc;
      },
      {} as Record<string, number>,
    ),
  });
}
