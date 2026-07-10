/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:users"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    include: { role: { select: { id: true, name: true, permissions: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    users.map((u) => ({ ...u, passwordHash: undefined })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:users"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, username, password, roleId, canApprove } = await req.json();
  if (!email || !username || !password || !roleId)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing)
    return NextResponse.json(
      { error: "Email or username already exists" },
      { status: 409 },
    );

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      roleId,
      canApprove: !!canApprove,
      mustChangePassword: true,
    },
    include: { role: { select: { id: true, name: true, permissions: true } } },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "User",
      entityId: user.id,
      action: "CREATE",
      actorUserId: (session.user as any).id,
      diff: { after: { ...user, passwordHash: undefined } },
    },
  });

  return NextResponse.json(
    { ...user, passwordHash: undefined },
    { status: 201 },
  );
}
