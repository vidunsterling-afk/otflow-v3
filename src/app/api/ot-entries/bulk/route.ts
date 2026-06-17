export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("ot:approve"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    ids,
    action,
    decisionReason,
  }: { ids: string[]; action: "approve" | "reject"; decisionReason?: string } =
    body;

  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json(
      { error: "ids must be a non-empty array" },
      { status: 400 },
    );

  if (action !== "approve" && action !== "reject")
    return NextResponse.json(
      { error: "action must be approve or reject" },
      { status: 400 },
    );

  const actorId = (session.user as any).id;

  // Process all entries concurrently; collect results individually
  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const existing = await prisma.otEntry.findUnique({ where: { id } });
      if (!existing) throw new Error("Not found");
      if (existing.status !== "PENDING") throw new Error("Not pending");

      if (action === "approve") {
        const approvedTotal =
          existing.normalMinutes +
          existing.doubleMinutes * 2 +
          existing.tripleMinutes * 3;

        const updated = await prisma.otEntry.update({
          where: { id },
          data: {
            status: "APPROVED",
            decisionReason: decisionReason ?? null,
            decidedById: actorId,
            decidedAt: new Date(),
            isApprovedOverride: false,
            approvedNormalMinutes: existing.normalMinutes,
            approvedDoubleMinutes: existing.doubleMinutes,
            approvedTripleMinutes: existing.tripleMinutes,
            approvedTotalMinutes: approvedTotal,
            updatedById: actorId,
          },
        });

        await prisma.auditLog.create({
          data: {
            entityType: "OtEntry",
            entityId: id,
            action: "APPROVE",
            actorUserId: actorId,
            diff: { before: existing, after: updated },
          },
        });

        return id;
      } else {
        const updated = await prisma.otEntry.update({
          where: { id },
          data: {
            status: "REJECTED",
            decisionReason: decisionReason ?? null,
            decidedById: actorId,
            decidedAt: new Date(),
            updatedById: actorId,
          },
        });

        await prisma.auditLog.create({
          data: {
            entityType: "OtEntry",
            entityId: id,
            action: "REJECT",
            actorUserId: actorId,
            diff: { before: existing, after: updated },
          },
        });

        return id;
      }
    }),
  );

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      succeeded.push(result.value);
    } else {
      failed.push({
        id: ids[i],
        error:
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown error",
      });
    }
  });

  return NextResponse.json({ succeeded, failed });
}
