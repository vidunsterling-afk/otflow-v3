export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcOtMinutes } from "@/lib/otCalc";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("weekStart");
  const weekEnd = searchParams.get("weekEnd");
  const date = searchParams.get("date");

  if (date) {
    const entries = await prisma.otEntry.findMany({
      where: { workDate: date },
      include: { employee: { select: { name: true, empId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(entries);
  }

  if (weekStart && weekEnd) {
    const entries = await prisma.otEntry.groupBy({
      by: ["workDate", "status"],
      where: { workDate: { gte: weekStart, lte: weekEnd } },
      _count: { _all: true },
    });
    return NextResponse.json(entries);
  }

  return NextResponse.json({ error: "Missing params" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // ── Bulk: body is an array ────────────────────────────────────────
  if (Array.isArray(body)) {
    const results = await Promise.allSettled(
      body.map((item, index) => createSingleEntry(item, session)),
    );

    const succeeded: unknown[] = [];
    const failed: { index: number; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        failed.push({
          index,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown error",
        });
      }
    });

    return NextResponse.json({ succeeded, failed }, { status: 201 });
  }

  // ── Single: body is an object (existing behaviour) ────────────────
  try {
    const entry = await createSingleEntry(body, session);
    return NextResponse.json(entry, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Failed" }, { status: 400 });
  }
}
// ── Extracted single-entry creation logic ─────────────────────────

async function createSingleEntry(body: any, session: any) {
  const {
    employeeId,
    workDate,
    shift,
    inTime,
    outTime,
    reason,
    manualOverride,
    normalMinutes: manualNormal,
    doubleMinutes: manualDouble,
    tripleMinutes: manualTriple,
  } = body;

  if (!employeeId || !workDate || !shift) {
    throw new Error(
      `Missing required fields: employeeId=${employeeId}, workDate=${workDate}, shift=${shift}`,
    );
  }

  const isNoShift = shift === "NO_SHIFT";

  let calcResult = {
    normalMinutes: 0,
    doubleMinutes: 0,
    tripleMinutes: 0,
    isNight: false,
  };

  if (!isNoShift && !manualOverride) {
    const tripleDay = await prisma.tripleOtDay.findUnique({
      where: { date: workDate },
    });
    calcResult = calcOtMinutes({
      workDate,
      shift,
      inTime,
      outTime,
      isTripleDay: !!tripleDay,
    });
  }

  if (manualOverride) {
    calcResult = {
      normalMinutes: manualNormal ?? 0,
      doubleMinutes: manualDouble ?? 0,
      tripleMinutes: manualTriple ?? 0,
      isNight: false,
    };
  }

  let entry;
  try {
    entry = await prisma.otEntry.create({
      data: {
        employeeId,
        workDate,
        shift,
        inTime: isNoShift ? null : inTime,
        outTime: isNoShift ? null : outTime,
        reason,
        ...calcResult,
        manualOverride: !!manualOverride,
        status: "PENDING",
        createdById: (session.user as any).id,
      },
      include: { employee: { select: { name: true, empId: true } } },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new Error(
        `Duplicate entry: an OT record for this employee on ${workDate} already exists.`,
      );
    }
    throw e;
  }

  await prisma.auditLog.create({
    data: {
      entityType: "OtEntry",
      entityId: entry.id,
      action: "CREATE",
      actorUserId: (session.user as any).id,
      diff: { after: entry },
    },
  });

  return entry;
}
