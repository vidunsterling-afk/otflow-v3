export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcOtMinutes } from "@/lib/otCalc";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const entry = await prisma.otEntry.findUnique({
    where: { id },
    include: { employee: { select: { name: true, empId: true } } },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.otEntry.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  // APPROVE
  if (action === "approve") {
    const permissions = (session.user as any).permissions ?? [];
    if (!permissions.includes("ot:approve"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const useOverride = body.isApprovedOverride ?? false;
    let approvedNormal = existing.normalMinutes;
    let approvedDouble = existing.doubleMinutes;
    let approvedTriple = existing.tripleMinutes;

    if (useOverride) {
      approvedNormal = body.approvedNormalMinutes ?? 0;
      approvedDouble = body.approvedDoubleMinutes ?? 0;
      approvedTriple = body.approvedTripleMinutes ?? 0;
    }

    const approvedTotal =
      approvedNormal + approvedDouble * 2 + approvedTriple * 3;

    const updated = await prisma.otEntry.update({
      where: { id },
      data: {
        status: "APPROVED",
        decisionReason: body.decisionReason,
        decidedById: (session.user as any).id,
        decidedAt: new Date(),
        isApprovedOverride: useOverride,
        approvedNormalMinutes: approvedNormal,
        approvedDoubleMinutes: approvedDouble,
        approvedTripleMinutes: approvedTriple,
        approvedTotalMinutes: approvedTotal,
        updatedById: (session.user as any).id,
      },
      include: { employee: { select: { name: true, empId: true } } },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "OtEntry",
        entityId: id,
        action: "APPROVE",
        actorUserId: (session.user as any).id,
        diff: { before: existing, after: updated },
      },
    });

    return NextResponse.json(updated);
  }

  // REJECT
  if (action === "reject") {
    const permissions = (session.user as any).permissions ?? [];
    if (!permissions.includes("ot:approve"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await prisma.otEntry.update({
      where: { id },
      data: {
        status: "REJECTED",
        decisionReason: body.decisionReason,
        decidedById: (session.user as any).id,
        decidedAt: new Date(),
        updatedById: (session.user as any).id,
      },
      include: { employee: { select: { name: true, empId: true } } },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "OtEntry",
        entityId: id,
        action: "REJECT",
        actorUserId: (session.user as any).id,
        diff: { before: existing, after: updated },
      },
    });

    return NextResponse.json(updated);
  }

  // EDIT
  if (action === "edit") {
    const permissions = (session.user as any).permissions ?? [];
    if (!permissions.includes("ot:edit"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const {
      shift,
      inTime,
      outTime,
      reason,
      manualOverride,
      normalMinutes: manualNormal,
      doubleMinutes: manualDouble,
      tripleMinutes: manualTriple,
    } = body;

    const isNoShift = shift === "NO_SHIFT";
    let calcResult = {
      normalMinutes: existing.normalMinutes,
      doubleMinutes: existing.doubleMinutes,
      tripleMinutes: existing.tripleMinutes,
      isNight: existing.isNight,
    };

    if (!isNoShift && !manualOverride) {
      const tripleDay = await prisma.tripleOtDay.findUnique({
        where: { date: existing.workDate },
      });
      calcResult = calcOtMinutes({
        workDate: existing.workDate,
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

    const updated = await prisma.otEntry.update({
      where: { id },
      data: {
        shift,
        inTime: isNoShift ? null : inTime,
        outTime: isNoShift ? null : outTime,
        reason,
        manualOverride: !!manualOverride,
        ...calcResult,
        status: "PENDING",
        updatedById: (session.user as any).id,
      },
      include: { employee: { select: { name: true, empId: true } } },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "OtEntry",
        entityId: id,
        action: "EDIT",
        actorUserId: (session.user as any).id,
        diff: { before: existing, after: updated },
      },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("ot:edit"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.otEntry.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.otEntry.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      entityType: "OtEntry",
      entityId: id,
      action: "DELETE",
      actorUserId: (session.user as any).id,
      diff: { before: existing },
    },
  });

  return NextResponse.json({ success: true });
}
