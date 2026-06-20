export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const SETTINGS_DIR = path.join(process.cwd(), "public", "uploads");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "fingerprint-settings.json");

export interface FingerprintSettings {
  shiftGapHours: number;
  breakMaxMinutes: number;
  enableBreakTracking: boolean;
  nightShiftMode: boolean;
  firstPunchIsIn: boolean;
  minShiftMinutes: number;
}

export const DEFAULT_SETTINGS: FingerprintSettings = {
  shiftGapHours: 5,
  breakMaxMinutes: 60,
  enableBreakTracking: false,
  nightShiftMode: false,
  firstPunchIsIn: true,
  minShiftMinutes: 1,
};

export async function GET() {
  try {
    if (!existsSync(SETTINGS_PATH)) return NextResponse.json(DEFAULT_SETTINGS);
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    return NextResponse.json({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!existsSync(SETTINGS_DIR)) await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(body, null, 2), "utf-8");
  return NextResponse.json({ success: true });
}
