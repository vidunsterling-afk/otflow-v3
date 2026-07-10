/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:users"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { email, username, password, roleId, canApprove, isActive } = body;

  const before = await prisma.user.findUnique({ where: { id } });
  const updateData: any = {};
  if (email) updateData.email = email;
  if (username) updateData.username = username;
  if (roleId) updateData.roleId = roleId;
  if (canApprove !== undefined) updateData.canApprove = canApprove;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
    updateData.mustChangePassword = true;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { role: { select: { id: true, name: true, permissions: true } } },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "User",
      entityId: id,
      action: "EDIT",
      actorUserId: (session.user as any).id,
      diff: {
        before: { ...before, passwordHash: undefined },
        after: { ...updated, passwordHash: undefined },
      },
    },
  });

  return NextResponse.json({ ...updated, passwordHash: undefined });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:users"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const selfId = (session.user as any).id;
  if (id === selfId)
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 },
    );

  await prisma.user.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      entityType: "User",
      entityId: id,
      action: "DELETE",
      actorUserId: selfId,
    },
  });

  return NextResponse.json({ success: true });
}
