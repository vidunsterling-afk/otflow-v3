/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected" });
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", db: "disconnected", message: e.message },
      { status: 503 },
    );
  }
}
