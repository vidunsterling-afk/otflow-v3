export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const SETTINGS_DIR = path.join(process.cwd(), "public", "uploads");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "fingerprint-settings.json");

export interface FingerprintSettings {
  // Night OUT window: punches in this hour range = OUT from previous shift
  nightOutStartHour: number; // default 0  (midnight)
  nightOutEndHour: number; // default 5  (up to 05:59)

  // Morning IN window: punches in this hour range = IN for day shift
  morningInStartHour: number; // default 6
  morningInEndHour: number; // default 11 (up to 11:59)

  // Evening OUT window: punches in this hour range = OUT from day shift
  eveningOutStartHour: number; // default 13
  eveningOutEndHour: number; // default 23

  // Middle punches (between IN and OUT on same day)
  middlePunchMode: "ignore" | "label"; // ignore = skip, label = MIDDLE

  // Shift detection from IN time
  shift1StartHour: number; // default 6  (Shift 1 starts ~6:30)
  shift1EndHour: number; // default 7  (if IN before 8:00 = Shift 1)
  shift2StartHour: number; // default 8  (Shift 2 starts ~8:30)
  shift2EndHour: number; // default 10 (if IN between 8–10 = Shift 2)
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
