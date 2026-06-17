export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const where = year ? { date: { startsWith: year } } : {};

  const days = await prisma.tripleOtDay.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return NextResponse.json(days);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("triple_days:manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { date, note } = await req.json();
  if (!date)
    return NextResponse.json({ error: "Date required" }, { status: 400 });

  const existing = await prisma.tripleOtDay.findUnique({ where: { date } });
  if (existing)
    return NextResponse.json(
      { error: "Date already marked as triple day" },
      { status: 409 },
    );

  const day = await prisma.tripleOtDay.create({ data: { date, note } });

  await prisma.auditLog.create({
    data: {
      entityType: "TripleOtDay",
      entityId: day.id,
      action: "CREATE",
      actorUserId: (session.user as any).id,
      diff: { after: day },
    },
  });

  return NextResponse.json(day, { status: 201 });
}
