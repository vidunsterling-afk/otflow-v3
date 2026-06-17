export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reasons = await prisma.decisionReason.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { sort: "asc" }],
  });

  return NextResponse.json(reasons);
}
