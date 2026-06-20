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

export type LogType = "IN" | "OUT" | "BREAK_OUT" | "BREAK_IN";

export interface Log {
  empId: string;
  date: string;
  time: string;
  datetime: Date;
  type: LogType;
  shiftIndex: number;
  note?: string;
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

function parseRawFile(buffer: string) {
  const lines = buffer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const results: {
    empId: string;
    date: string;
    time: string;
    datetime: Date;
  }[] = [];

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
    results.push({ empId, date: datePart, time: timePart, datetime });
  }
  return results;
}

// ── The smart algorithm ───────────────────────────────────────────────────────
function processWithSettings(
  rawLogs: { empId: string; date: string; time: string; datetime: Date }[],
  settings: FingerprintSettings,
): Log[] {
  const {
    shiftGapHours,
    breakMaxMinutes,
    enableBreakTracking,
    nightShiftMode,
    firstPunchIsIn,
    minShiftMinutes,
  } = settings;

  const shiftGapMs = shiftGapHours * 60 * 60 * 1000;
  const breakMaxMs = breakMaxMinutes * 60 * 1000;
  const minShiftMs = minShiftMinutes * 60 * 1000;

  // Group by employee
  const byEmployee = new Map<string, typeof rawLogs>();
  for (const log of rawLogs) {
    if (!byEmployee.has(log.empId)) byEmployee.set(log.empId, []);
    byEmployee.get(log.empId)!.push(log);
  }

  const result: Log[] = [];

  for (const [empId, punches] of byEmployee) {
    // Sort by time
    punches.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    // Night shift mode: shift punches between 00:00–05:59 to "previous day"
    // by using a shifted date key (subtract 6 hours for grouping purposes)
    const getDateKey = (dt: Date): string => {
      if (!nightShiftMode) return dt.toISOString().split("T")[0];
      const shifted = new Date(dt.getTime() - 6 * 60 * 60 * 1000);
      return shifted.toISOString().split("T")[0];
    };

    // Group by shifted date
    const byDate = new Map<string, typeof punches>();
    for (const punch of punches) {
      const key = getDateKey(punch.datetime);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(punch);
    }

    // Process each day's punches
    for (const [, dayPunches] of byDate) {
      dayPunches.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

      // Filter noise: remove punches too close to the previous one
      const filtered: typeof dayPunches = [];
      for (let i = 0; i < dayPunches.length; i++) {
        if (i === 0) {
          filtered.push(dayPunches[i]);
          continue;
        }
        const gap =
          dayPunches[i].datetime.getTime() -
          dayPunches[i - 1].datetime.getTime();
        if (gap >= minShiftMs) {
          filtered.push(dayPunches[i]);
        }
        // else: too close together, likely a double-tap, skip
      }

      if (filtered.length === 0) continue;

      let shiftIndex = 0;

      for (let i = 0; i < filtered.length; i++) {
        const punch = filtered[i];
        const prev = filtered[i - 1];
        const next = filtered[i + 1];

        const gapFromPrev = prev
          ? punch.datetime.getTime() - prev.datetime.getTime()
          : null;
        const gapToNext = next
          ? next.datetime.getTime() - punch.datetime.getTime()
          : null;

        let type: LogType;
        let note: string | undefined;

        if (i === 0) {
          // First punch of this day group
          type = firstPunchIsIn ? "IN" : "OUT";
          note = firstPunchIsIn
            ? "First punch of day — assumed IN"
            : "First punch of day — assumed OUT";
        } else if (gapFromPrev !== null && gapFromPrev >= shiftGapMs) {
          // Large gap from previous punch = new shift starting
          // Previous punch was already marked, this one starts a new shift
          shiftIndex++;
          type = "IN";
          note = `New shift detected (gap: ${Math.round(gapFromPrev / 3600000)}h)`;
        } else if (
          enableBreakTracking &&
          gapFromPrev !== null &&
          gapFromPrev <= breakMaxMs
        ) {
          // Small gap = break
          // The previous punch was BREAK_OUT, this one is BREAK_IN
          // Fix the previous entry's type
          const prevEntry = result[result.length - 1];
          if (
            prevEntry &&
            prevEntry.empId === empId &&
            prevEntry.type === "IN"
          ) {
            prevEntry.type = "BREAK_OUT";
            prevEntry.note = `Break detected (gap: ${Math.round(gapFromPrev / 60000)}min)`;
          }
          type = "BREAK_IN";
          note = `Break end (${Math.round(gapFromPrev / 60000)}min break)`;
        } else {
          // Normal alternation within a shift
          const lastEntry = result.findLast(
            (r) => r.empId === empId && r.shiftIndex === shiftIndex,
          );
          if (!lastEntry) {
            type = firstPunchIsIn ? "IN" : "OUT";
          } else if (lastEntry.type === "IN" || lastEntry.type === "BREAK_IN") {
            type = "OUT";
          } else {
            type = "IN";
          }
        }

        result.push({
          empId: punch.empId,
          date: punch.date,
          time: punch.time,
          datetime: punch.datetime,
          type,
          shiftIndex,
          note,
        });
      }
    }
  }

  // Final sort: by empId then datetime
  result.sort((a, b) => {
    if (a.empId !== b.empId) return a.empId.localeCompare(b.empId);
    return a.datetime.getTime() - b.datetime.getTime();
  });

  return result;
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
    const rawLogs = parseRawFile(buffer);
    if (rawLogs.length === 0)
      return NextResponse.json(
        { error: "No valid records found in file" },
        { status: 400 },
      );

    const settings = await loadSettings();
    const logs = processWithSettings(rawLogs, settings);

    const csvLines = [
      "EmpID,Date,Time,Type,Shift",
      ...logs.map(
        (l) => `${l.empId},${l.date},${l.time},${l.type},${l.shiftIndex + 1}`,
      ),
    ];

    return NextResponse.json({ logs, csv: csvLines.join("\n"), settings });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error processing file" },
      { status: 500 },
    );
  }
}
