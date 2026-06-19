export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Run delete + fetch in parallel instead of sequentially
  const [notifications] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, createdAt: { gte: cutoff } }, // filter in query, skip delete
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.deleteMany({
      where: { userId, createdAt: { lt: cutoff } },
    }),
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length; // count in JS, no extra query

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
