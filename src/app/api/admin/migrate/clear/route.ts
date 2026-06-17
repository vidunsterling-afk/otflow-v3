export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:users"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { targets } = (await req.json()) as { targets: string[] };
  const results: Record<string, number> = {};

  // Order matters for FK constraints
  if (targets.includes("otEntries")) {
    const d = await prisma.otEntry.deleteMany({});
    results.otEntries = d.count;
  }
  if (targets.includes("auditLogs")) {
    const d = await prisma.auditLog.deleteMany({});
    results.auditLogs = d.count;
  }
  if (targets.includes("employees")) {
    const d = await prisma.employee.deleteMany({});
    results.employees = d.count;
  }
  if (targets.includes("tripleOtDays")) {
    const d = await prisma.tripleOtDay.deleteMany({});
    results.tripleOtDays = d.count;
  }
  if (targets.includes("decisionReasons")) {
    const d = await prisma.decisionReason.deleteMany({});
    results.decisionReasons = d.count;
  }
  if (targets.includes("users")) {
    // Keep current session user
    const selfId = (session.user as any).id;
    const d = await prisma.user.deleteMany({ where: { id: { not: selfId } } });
    results.users = d.count;
  }
  if (targets.includes("roles")) {
    // Keep roles used by remaining users
    const usedRoles = await prisma.user.findMany({ select: { roleId: true } });
    const usedIds = usedRoles.map((u) => u.roleId);
    const d = await prisma.role.deleteMany({
      where: { id: { notIn: usedIds } },
    });
    results.roles = d.count;
  }

  return NextResponse.json({ success: true, cleared: results });
}
