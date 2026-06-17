export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("triple_days:manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { note } = await req.json();
  const updated = await prisma.tripleOtDay.update({
    where: { id },
    data: { note },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("triple_days:manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const before = await prisma.tripleOtDay.findUnique({ where: { id } });
  await prisma.tripleOtDay.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      entityType: "TripleOtDay",
      entityId: id,
      action: "DELETE",
      actorUserId: (session.user as any).id,
      diff: { before },
    },
  });

  return NextResponse.json({ success: true });
}
