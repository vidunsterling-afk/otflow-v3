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

  const { id } = await params;
  const { label, active, sort } = await req.json();
  const updated = await prisma.decisionReason.update({
    where: { id },
    data: {
      ...(label !== undefined && { label }),
      ...(active !== undefined && { active }),
      ...(sort !== undefined && { sort }),
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

  const { id } = await params;
  await prisma.decisionReason.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
