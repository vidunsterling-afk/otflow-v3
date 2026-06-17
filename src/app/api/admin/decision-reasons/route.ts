export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reasons = await prisma.decisionReason.findMany({
    orderBy: [{ type: "asc" }, { sort: "asc" }],
  });
  return NextResponse.json(reasons);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:roles"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, label, sort } = await req.json();
  if (!type || !label)
    return NextResponse.json(
      { error: "type and label required" },
      { status: 400 },
    );

  const reason = await prisma.decisionReason.create({
    data: { type, label, sort: sort ?? 0 },
  });
  return NextResponse.json(reason, { status: 201 });
}
