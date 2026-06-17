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
  if (!permissions.includes("admin:roles"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, permissions: perms } = await req.json();
  const before = await prisma.role.findUnique({ where: { id } });
  const updated = await prisma.role.update({
    where: { id },
    data: { ...(name ? { name } : {}), permissions: perms },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "Role",
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
  if (!permissions.includes("admin:roles"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const usersWithRole = await prisma.user.count({ where: { roleId: id } });
  if (usersWithRole > 0)
    return NextResponse.json(
      { error: "Cannot delete role assigned to users" },
      { status: 409 },
    );

  await prisma.role.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      entityType: "Role",
      entityId: id,
      action: "DELETE",
      actorUserId: (session.user as any).id,
    },
  });

  return NextResponse.json({ success: true });
}
