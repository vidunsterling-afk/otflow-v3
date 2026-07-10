/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { currentPassword, newPassword } = await req.json();

  if (!newPassword || newPassword.length < 8)
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If mustChangePassword is true and they came from an admin reset,
  // we still verify the current (temp) password so someone else can't hijack the session
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid)
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    );

  if (currentPassword === newPassword)
    return NextResponse.json(
      { error: "New password must be different from current password" },
      { status: 400 },
    );

  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newHash,
      mustChangePassword: false, // clear the flag
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "User",
      entityId: userId,
      action: "PASSWORD_CHANGE",
      actorUserId: userId,
      diff: { after: { passwordChanged: true, mustChangePassword: false } },
    },
  });

  return NextResponse.json({ success: true });
}
