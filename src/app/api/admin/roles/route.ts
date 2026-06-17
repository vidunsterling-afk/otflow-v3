export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(roles);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:roles"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, permissions: perms } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Name required" }, { status: 400 });

  const role = await prisma.role.create({
    data: { name: name.trim(), permissions: perms ?? [] },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "Role",
      entityId: role.id,
      action: "CREATE",
      actorUserId: (session.user as any).id,
      diff: { after: role },
    },
  });

  return NextResponse.json(role, { status: 201 });
}
