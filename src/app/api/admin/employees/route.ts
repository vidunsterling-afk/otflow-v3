export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 20;

  const where: any = {
    isDeleted: false,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { empId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { empId: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return NextResponse.json({
    employees,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:employees"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { empId, name } = await req.json();
  if (!empId?.trim() || !name?.trim())
    return NextResponse.json(
      { error: "empId and name are required" },
      { status: 400 },
    );

  const existing = await prisma.employee.findUnique({
    where: { empId: empId.trim() },
  });
  if (existing)
    return NextResponse.json(
      { error: "Employee ID already exists" },
      { status: 409 },
    );

  const employee = await prisma.employee.create({
    data: { empId: empId.trim(), name: name.trim() },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "Employee",
      entityId: employee.id,
      action: "CREATE",
      actorUserId: (session.user as any).id,
      diff: { after: employee },
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
