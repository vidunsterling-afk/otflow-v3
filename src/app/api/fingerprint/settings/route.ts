export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface FingerprintSettings {
  nightOutStartHour: number;
  nightOutEndHour: number;
  morningInStartHour: number;
  morningInEndHour: number;
  eveningOutStartHour: number;
  eveningOutEndHour: number;
  middlePunchMode: "ignore" | "label";
  shift1StartHour: number;
  shift1EndHour: number;
  shift2StartHour: number;
  shift2EndHour: number;
}

export const DEFAULT_SETTINGS: FingerprintSettings = {
  nightOutStartHour: 0,
  nightOutEndHour: 5,
  morningInStartHour: 6,
  morningInEndHour: 11,
  eveningOutStartHour: 13,
  eveningOutEndHour: 23,
  middlePunchMode: "ignore",
  shift1StartHour: 5,
  shift1EndHour: 7,
  shift2StartHour: 8,
  shift2EndHour: 11,
};

const SETTINGS_KEY = "fingerprint_settings";

export async function GET() {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    if (!row) return NextResponse.json(DEFAULT_SETTINGS);
    return NextResponse.json({ ...DEFAULT_SETTINGS, ...JSON.parse(row.value) });
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(body) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(body) },
  });

  return NextResponse.json({ success: true });
}
