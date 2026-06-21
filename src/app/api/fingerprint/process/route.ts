export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  DEFAULT_SETTINGS,
  type FingerprintSettings,
} from "@/app/api/fingerprint/settings/route";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export type LogType = "IN" | "OUT" | "MIDDLE";

export interface ProcessedLog {
  empId: string;
  date: string; // the logical date (night OUT mapped to previous day)
  time: string;
  hour: number;
  type: LogType;
  shift: string; // "Shift 1", "Shift 2", "Unknown", "N/A"
  note: string;
}

async function loadSettings(): Promise<FingerprintSettings> {
  try {
    const p = path.join(
      process.cwd(),
      "public",
      "uploads",
      "fingerprint-settings.json",
    );
    if (!existsSync(p)) return DEFAULT_SETTINGS;
    const raw = await readFile(p, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface RawPunch {
  empId: string;
  datetime: Date;
  rawDate: string; // actual calendar date from file
  time: string;
  hour: number;
}

function parseFile(buffer: string): RawPunch[] {
  const lines = buffer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const results: RawPunch[] = [];

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 2) continue;
    const empId = cols[0].trim();
    const datetimeRaw = cols[1].trim();
    if (!empId || !datetimeRaw) continue;
    const [datePart, timePart] = datetimeRaw.split(" ");
    if (!datePart || !timePart) continue;
    const datetime = new Date(`${datePart}T${timePart}`);
    if (isNaN(datetime.getTime())) continue;
    const hour = parseInt(timePart.split(":")[0]);
    results.push({ empId, datetime, rawDate: datePart, time: timePart, hour });
  }
  return results;
}

function detectShift(hour: number, s: FingerprintSettings): string {
  if (hour >= s.shift1StartHour && hour <= s.shift1EndHour) return "Shift 1";
  if (hour >= s.shift2StartHour && hour <= s.shift2EndHour) return "Shift 2";
  return "Unknown";
}

function classifyPunch(
  hour: number,
  s: FingerprintSettings,
): "night_out" | "morning_in" | "evening_out" | "middle" {
  if (hour >= s.nightOutStartHour && hour <= s.nightOutEndHour)
    return "night_out";
  if (hour >= s.morningInStartHour && hour <= s.morningInEndHour)
    return "morning_in";
  if (hour >= s.eveningOutStartHour && hour <= s.eveningOutEndHour)
    return "evening_out";
  return "middle";
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function processWithSettings(
  raw: RawPunch[],
  s: FingerprintSettings,
): ProcessedLog[] {
  const results: ProcessedLog[] = [];

  // Group by employee
  const byEmp = new Map<string, RawPunch[]>();
  for (const p of raw) {
    if (!byEmp.has(p.empId)) byEmp.set(p.empId, []);
    byEmp.get(p.empId)!.push(p);
  }

  for (const [empId, punches] of byEmp) {
    // Sort chronologically
    punches.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    // Map each punch to a logical date and classification
    // Night OUT punches (00:00–05:59) belong to the PREVIOUS calendar day
    const mapped = punches.map((p) => {
      const classification = classifyPunch(p.hour, s);
      const logicalDate =
        classification === "night_out"
          ? addDays(p.rawDate, -1) // midnight OUT → previous day
          : p.rawDate;

      return { ...p, classification, logicalDate };
    });

    // Group by logical date
    const byDate = new Map<string, typeof mapped>();
    for (const p of mapped) {
      if (!byDate.has(p.logicalDate)) byDate.set(p.logicalDate, []);
      byDate.get(p.logicalDate)!.push(p);
    }

    // Process each logical day
    for (const [logicalDate, dayPunches] of byDate) {
      // Sort by actual time within day
      dayPunches.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

      // Find the IN punch (morning) and OUT punch (evening or night)
      const inPunch = dayPunches.find((p) => p.classification === "morning_in");
      const outPunch = dayPunches.find(
        (p) =>
          p.classification === "evening_out" ||
          p.classification === "night_out",
      );
      const middlePunches = dayPunches.filter(
        (p) => p.classification === "middle",
      );

      // Determine shift from IN punch time
      const shiftLabel = inPunch ? detectShift(inPunch.hour, s) : "Unknown";

      // Add IN punch
      if (inPunch) {
        results.push({
          empId,
          date: logicalDate,
          time: inPunch.time,
          hour: inPunch.hour,
          type: "IN",
          shift: shiftLabel,
          note: `Day shift start — ${shiftLabel}`,
        });
      }

      // Always include middle punches in output — mode only controls the label
      for (const mp of middlePunches) {
        results.push({
          empId,
          date: logicalDate,
          time: mp.time,
          hour: mp.hour,
          type: "MIDDLE",
          shift: shiftLabel,
          note:
            s.middlePunchMode === "ignore"
              ? "Mid-shift punch — displayed but not counted"
              : "Mid-shift punch (lunch/errand)",
        });
      }
      // if middlePunchMode === "ignore" we just skip them

      // Add OUT punch
      if (outPunch) {
        results.push({
          empId,
          date: logicalDate,
          time: outPunch.time,
          hour: outPunch.hour,
          type: "OUT",
          shift: shiftLabel,
          note:
            outPunch.classification === "night_out"
              ? "Night shift end (mapped to previous day)"
              : "Day shift end",
        });
      }

      // Edge case: only one punch for the day and no clear IN/OUT
      if (!inPunch && !outPunch && dayPunches.length > 0) {
        const p = dayPunches[0];
        results.push({
          empId,
          date: logicalDate,
          time: p.time,
          hour: p.hour,
          type: "IN",
          shift: "Unknown",
          note: "Only punch of day — assumed IN",
        });
      }
    }
  }

  // Final sort: empId then date then time
  results.sort((a, b) => {
    if (a.empId !== b.empId) return a.empId.localeCompare(b.empId);
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  return results;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = await file.text();
    const raw = parseFile(buffer);
    if (raw.length === 0)
      return NextResponse.json(
        { error: "No valid records found" },
        { status: 400 },
      );

    const settings = await loadSettings();
    const logs = processWithSettings(raw, settings);

    const csv = [
      "EmpID,Date,Time,Type,Shift,Note",
      ...logs.map(
        (l) =>
          `${l.empId},${l.date},${l.time},${l.type},${l.shift},"${l.note}"`,
      ),
    ].join("\n");

    // Stats for feedback
    const inCount = logs.filter((l) => l.type === "IN").length;
    const outCount = logs.filter((l) => l.type === "OUT").length;
    const middleCount = logs.filter((l) => l.type === "MIDDLE").length;
    const shift1Count = logs.filter((l) => l.shift === "Shift 1").length;
    const shift2Count = logs.filter((l) => l.shift === "Shift 2").length;

    return NextResponse.json({
      logs,
      csv,
      settings,
      stats: {
        total: logs.length,
        inCount,
        outCount,
        middleCount,
        shift1Count,
        shift2Count,
        rawCount: raw.length,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error processing file" },
      { status: 500 },
    );
  }
}
