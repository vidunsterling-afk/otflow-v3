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
  if (!permissions.includes("admin:employees"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Name required" }, { status: 400 });

  const before = await prisma.employee.findUnique({ where: { id } });
  const updated = await prisma.employee.update({
    where: { id },
    data: { name: name.trim() },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "Employee",
      entityId: id,
      action: "EDIT",
      actorUserId: (session.user as any).id,
      diff: { before, after: updated },
    },
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
  if (!permissions.includes("admin:employees"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const before = await prisma.employee.findUnique({ where: { id } });
  const updated = await prisma.employee.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "Employee",
      entityId: id,
      action: "DELETE",
      actorUserId: (session.user as any).id,
      diff: { before, after: updated },
    },
  });

  return NextResponse.json({ success: true });
}
