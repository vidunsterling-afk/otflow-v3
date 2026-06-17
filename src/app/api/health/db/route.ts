import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$connect();

    return NextResponse.json({
      status: "ok",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
      },
      { status: 500 }
    );
  }
}