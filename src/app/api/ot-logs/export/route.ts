/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";

function toHrs(mins: number): number {
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
}

function fmt(mins: number): string | number {
  return mins > 0 ? toHrs(mins) : "";
}

function buildDateRange(
  range: string,
  from: string | null,
  to: string | null,
  now: Date,
) {
  if (range === "custom" && from && to) return { dateFrom: from, dateTo: to };
  if (range === "day") {
    const d = from ? from : format(now, "yyyy-MM-dd");
    return { dateFrom: d, dateTo: d };
  }
  if (range === "month")
    return {
      dateFrom: format(startOfMonth(now), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  if (range === "year")
    return {
      dateFrom: format(startOfYear(now), "yyyy-MM-dd"),
      dateTo: format(endOfYear(now), "yyyy-MM-dd"),
    };
  return {
    dateFrom: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    dateTo: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

// Style helpers — apply to a cell address
function styleCell(ws: XLSX.WorkSheet, addr: string, style: any) {
  if (!ws[addr]) ws[addr] = { t: "s", v: "" };
  ws[addr].s = style;
}

const HEADER_STYLE = {
  font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "2563EB" } },
  alignment: { horizontal: "center" },
  border: {
    bottom: { style: "thin", color: { rgb: "1D4ED8" } },
    right: { style: "thin", color: { rgb: "1D4ED8" } },
  },
};
const EMP_HEADER_STYLE = {
  font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "1E40AF" } },
  alignment: { horizontal: "left" },
};
const SUBTOTAL_STYLE = {
  font: { bold: true, sz: 9, color: { rgb: "1E3A5F" } },
  fill: { fgColor: { rgb: "DBEAFE" } },
  alignment: { horizontal: "right" },
};
const META_LABEL_STYLE = {
  font: { bold: true, sz: 9, color: { rgb: "374151" } },
};
const META_VALUE_STYLE = {
  font: { sz: 9, color: { rgb: "111827" } },
};
const ALT_ROW_STYLE = {
  fill: { fgColor: { rgb: "F8FAFF" } },
  font: { sz: 9 },
};
const NORMAL_ROW_STYLE = {
  font: { sz: 9 },
};
const SUMMARY_TOTAL_STYLE = {
  font: { bold: true, sz: 10, color: { rgb: "1E3A5F" } },
  fill: { fgColor: { rgb: "EFF6FF" } },
};

function colLetter(n: number): string {
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

// ── SHEET 1: Summary ─────────────────────────────────────────────────────────
function buildSummarySheet(
  entries: any[],
  meta: {
    scope: string;
    dateFrom: string;
    dateTo: string;
    statusFilter: string;
    companyName: string;
    generatedAt: string;
  },
) {
  const ws: XLSX.WorkSheet = {};
  const rows: any[][] = [];

  // Title block
  rows.push([meta.companyName || "OTFlow"]);
  rows.push(["OVERTIME REPORT - SUMMARY"]);
  rows.push([]);
  rows.push(["Scope", meta.scope]);
  rows.push(["Period", `${meta.dateFrom} → ${meta.dateTo}`]);
  rows.push(["Status Filter", meta.statusFilter]);
  rows.push(["Generated At", meta.generatedAt]);
  rows.push([]);

  // Overall
  const pending = entries.filter((e) => e.status === "PENDING").length;
  const approved = entries.filter((e) => e.status === "APPROVED").length;
  const rejected = entries.filter((e) => e.status === "REJECTED").length;
  const totalNormal = entries.reduce((s, e) => s + e.normalMinutes, 0);
  const totalDouble = entries.reduce((s, e) => s + e.doubleMinutes, 0);
  const totalTriple = entries.reduce((s, e) => s + e.tripleMinutes, 0);
  const totalApproved = entries.reduce((s, e) => s + e.approvedTotalMinutes, 0);

  rows.push(["OVERALL SUMMARY"]);
  rows.push(["Records", entries.length]);
  rows.push(["Pending", pending]);
  rows.push(["Approved", approved]);
  rows.push(["Rejected", rejected]);
  rows.push([]);
  rows.push(["Normal OT (hrs)", fmt(totalNormal)]);
  rows.push(["Double OT (hrs)", fmt(totalDouble)]);
  rows.push(["Triple OT (hrs)", fmt(totalTriple)]);
  rows.push(["Total OT (hrs)", fmt(totalNormal + totalDouble + totalTriple)]);
  rows.push(["Approved Total (hrs)", fmt(totalApproved)]);
  rows.push([]);

  // Employee-wise summary table header
  const empTableStart = rows.length;
  rows.push(["EMPLOYEE-WISE SUMMARY"]);
  rows.push([
    "Emp ID",
    "Employee Name",
    "Count",
    "Pending",
    "Approved",
    "Rejected",
    "Normal (Hrs)",
    "Double (Hrs)",
    "Triple (Hrs)",
    "Total (Hrs)",
    "Approved (Hrs)",
  ]);

  // Group by employee
  const empMap = new Map<string, any>();
  for (const e of entries) {
    const key = e.employee.empId;
    if (!empMap.has(key)) {
      empMap.set(key, {
        empId: e.employee.empId,
        name: e.employee.name,
        count: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        normal: 0,
        double: 0,
        triple: 0,
        approvedMins: 0,
      });
    }
    const r = empMap.get(key);
    r.count++;
    if (e.status === "PENDING") r.pending++;
    else if (e.status === "APPROVED") r.approved++;
    else r.rejected++;
    r.normal += e.normalMinutes;
    r.double += e.doubleMinutes;
    r.triple += e.tripleMinutes;
    r.approvedMins += e.approvedTotalMinutes;
  }

  let empRowIdx = empTableStart + 2;
  for (const [, r] of empMap) {
    rows.push([
      r.empId,
      r.name,
      r.count,
      r.pending,
      r.approved,
      r.rejected,
      fmt(r.normal),
      fmt(r.double),
      fmt(r.triple),
      fmt(r.normal + r.double + r.triple),
      fmt(r.approvedMins),
    ]);
    empRowIdx++;
  }

  // Totals row
  rows.push([
    "",
    "TOTAL",
    empMap.size > 0 ? entries.length : 0,
    pending,
    approved,
    rejected,
    fmt(totalNormal),
    fmt(totalDouble),
    fmt(totalTriple),
    fmt(totalNormal + totalDouble + totalTriple),
    fmt(totalApproved),
  ]);

  // Write all rows
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: "A1" });

  // Styles
  styleCell(ws, "A1", {
    font: { bold: true, sz: 15, color: { rgb: "1E3A5F" } },
  });
  styleCell(ws, "A2", {
    font: { bold: true, sz: 12, color: { rgb: "2563EB" } },
  });

  for (let i = 4; i <= 7; i++) {
    styleCell(ws, `A${i}`, META_LABEL_STYLE);
    styleCell(ws, `B${i}`, META_VALUE_STYLE);
  }

  // Overall summary section header
  styleCell(ws, `A9`, {
    font: { bold: true, sz: 10, color: { rgb: "1E3A5F" } },
    fill: { fgColor: { rgb: "EFF6FF" } },
  });

  // Emp table section header
  const eTs = empTableStart + 1;
  styleCell(ws, `A${eTs}`, {
    font: { bold: true, sz: 10, color: { rgb: "1E3A5F" } },
    fill: { fgColor: { rgb: "EFF6FF" } },
  });

  const empHdrRow = empTableStart + 2;
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].forEach((col) => {
    styleCell(ws, `${col}${empHdrRow}`, HEADER_STYLE);
  });

  // Data rows alternate color
  let dataRowN = empTableStart + 3;
  let alt = false;
  for (const _ of empMap) {
    const style = alt ? ALT_ROW_STYLE : NORMAL_ROW_STYLE;
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].forEach((col) => {
      styleCell(ws, `${col}${dataRowN}`, style);
    });
    alt = !alt;
    dataRowN++;
  }

  // Totals row
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].forEach((col) => {
    styleCell(ws, `${col}${dataRowN}`, SUMMARY_TOTAL_STYLE);
  });

  // Merges: title spans
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 10 } },
    { s: { r: empTableStart, c: 0 }, e: { r: empTableStart, c: 10 } },
  ];

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length, c: 10 },
  });
  setColWidths(ws, [12, 26, 8, 8, 10, 9, 14, 14, 14, 12, 14]);

  return ws;
}

// ── SHEET 2: Employee-wise Records ────────────────────────────────────────────
function buildRecordsSheet(
  entries: any[],
  meta: {
    scope: string;
    dateFrom: string;
    dateTo: string;
    statusFilter: string;
    companyName: string;
    generatedAt: string;
  },
) {
  const ws: XLSX.WorkSheet = {};
  const rows: any[][] = [];

  // Title
  rows.push([meta.companyName || "OTFlow"]);
  rows.push(["OVERTIME RECORDS - DETAILED"]);
  rows.push([]);
  rows.push(["Scope", meta.scope]);
  rows.push(["Period", `${meta.dateFrom} → ${meta.dateTo}`]);
  rows.push(["Status Filter", meta.statusFilter]);
  rows.push(["Generated At", meta.generatedAt]);
  rows.push([]);

  // Group entries by employee
  const empMap = new Map<string, any[]>();
  for (const e of entries) {
    const key = e.employee.empId;
    if (!empMap.has(key)) empMap.set(key, []);
    empMap.get(key)!.push(e);
  }

  // Sort employees by empId
  const sortedEmps = Array.from(empMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 11 } }, // placeholder, updated below
  ];
  // Remove the placeholder at index 2 — we'll add proper ones as we go
  merges.splice(2, 1);

  const COL_HEADERS = [
    "Work Date",
    "Shift",
    "Night",
    "In Time",
    "Out Time",
    "Normal (Hrs)",
    "Double (Hrs)",
    "Triple (Hrs)",
    "Total (Hrs)",
    "Approved (Hrs)",
    "Status",
    "Decision Reason",
  ];
  const NUM_COLS = COL_HEADERS.length;

  let currentRow = rows.length; // row index (0-based) of next row to add

  for (const [empId, empEntries] of sortedEmps) {
    const empName = empEntries[0].employee.name;

    // Employee section header row
    const empHdrRowIdx = currentRow;
    rows.push([
      `EMPLOYEE: ${empId} - ${empName}`,
      ...Array(NUM_COLS - 1).fill(""),
    ]);
    merges.push({
      s: { r: empHdrRowIdx, c: 0 },
      e: { r: empHdrRowIdx, c: NUM_COLS - 1 },
    });
    currentRow++;

    // Column headers
    const colHdrRowIdx = currentRow;
    rows.push(COL_HEADERS);
    currentRow++;

    // Data rows
    let nightCount = 0;
    let subNormal = 0,
      subDouble = 0,
      subTriple = 0,
      subApproved = 0;
    let altRow = false;

    for (const e of empEntries) {
      const isNight = e.isNight ? "1" : "";
      if (e.isNight) nightCount++;
      subNormal += e.normalMinutes;
      subDouble += e.doubleMinutes;
      subTriple += e.tripleMinutes;
      subApproved += e.approvedTotalMinutes;

      const dataRowIdx = currentRow;
      rows.push([
        e.workDate,
        e.shift,
        isNight,
        e.inTime ?? "",
        e.outTime ?? "",
        fmt(e.normalMinutes),
        fmt(e.doubleMinutes),
        fmt(e.tripleMinutes),
        fmt(e.normalMinutes + e.doubleMinutes + e.tripleMinutes),
        fmt(e.approvedTotalMinutes),
        e.status,
        e.decisionReason ?? "",
      ]);

      // Style data row
      const rowStyle = altRow ? ALT_ROW_STYLE : NORMAL_ROW_STYLE;
      for (let c = 0; c < NUM_COLS; c++) {
        const addr = `${colLetter(c)}${dataRowIdx + 1}`;
        styleCell(ws, addr, rowStyle);
      }
      altRow = !altRow;
      currentRow++;
    }

    // Subtotal row
    const subRowIdx = currentRow;
    rows.push([
      "",
      "",
      nightCount,
      "",
      "SUBTOTAL:",
      fmt(subNormal),
      fmt(subDouble),
      fmt(subTriple),
      fmt(subNormal + subDouble + subTriple),
      fmt(subApproved),
      "",
      "",
    ]);
    for (let c = 0; c < NUM_COLS; c++) {
      styleCell(ws, `${colLetter(c)}${subRowIdx + 1}`, SUBTOTAL_STYLE);
    }
    currentRow++;

    // Gap row
    rows.push([]);
    currentRow++;

    // Apply styles to emp header row
    for (let c = 0; c < NUM_COLS; c++) {
      styleCell(ws, `${colLetter(c)}${empHdrRowIdx + 1}`, EMP_HEADER_STYLE);
    }
    // Column headers
    for (let c = 0; c < NUM_COLS; c++) {
      styleCell(ws, `${colLetter(c)}${colHdrRowIdx + 1}`, HEADER_STYLE);
    }
  }

  // Write all rows
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: "A1" });

  // Title styles
  styleCell(ws, "A1", {
    font: { bold: true, sz: 15, color: { rgb: "1E3A5F" } },
  });
  styleCell(ws, "A2", {
    font: { bold: true, sz: 12, color: { rgb: "2563EB" } },
  });
  for (let i = 4; i <= 7; i++) {
    styleCell(ws, `A${i}`, META_LABEL_STYLE);
    styleCell(ws, `B${i}`, META_VALUE_STYLE);
  }

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: NUM_COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: NUM_COLS - 1 } },
    ...merges,
  ];

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length, c: NUM_COLS - 1 },
  });
  setColWidths(ws, [13, 10, 6, 9, 9, 13, 13, 13, 12, 13, 11, 20]);

  return ws;
}

// ── SHEET: Flat daily view (used for single-date exports) ─────────────────────
function buildDailySheet(
  entries: any[],
  meta: {
    scope: string;
    dateFrom: string;
    dateTo: string;
    statusFilter: string;
    companyName: string;
    generatedAt: string;
  },
) {
  const ws: XLSX.WorkSheet = {};
  const rows: any[][] = [];

  rows.push([meta.companyName || "OTFlow"]);
  rows.push([`DAILY OT REPORT — ${meta.dateFrom}`]);
  rows.push([]);
  rows.push(["Date", meta.dateFrom]);
  rows.push(["Status Filter", meta.statusFilter]);
  rows.push(["Generated At", meta.generatedAt]);
  rows.push([]);

  const totalNormal = entries.reduce((s, e) => s + e.normalMinutes, 0);
  const totalDouble = entries.reduce((s, e) => s + e.doubleMinutes, 0);
  const totalTriple = entries.reduce((s, e) => s + e.tripleMinutes, 0);
  const totalApproved = entries.reduce((s, e) => s + e.approvedTotalMinutes, 0);
  const pending = entries.filter((e) => e.status === "PENDING").length;
  const approved = entries.filter((e) => e.status === "APPROVED").length;
  const rejected = entries.filter((e) => e.status === "REJECTED").length;

  rows.push(["SUMMARY"]);
  rows.push(["Total Entries", entries.length]);
  rows.push(["Pending", pending]);
  rows.push(["Approved", approved]);
  rows.push(["Rejected", rejected]);
  rows.push(["Normal OT (hrs)", fmt(totalNormal)]);
  rows.push(["Double OT (hrs)", fmt(totalDouble)]);
  rows.push(["Triple OT (hrs)", fmt(totalTriple)]);
  rows.push(["Approved OT (hrs)", fmt(totalApproved)]);
  rows.push([]);

  const tableStart = rows.length;

  rows.push([
    "Emp ID",
    "Employee Name",
    "Shift",
    "In Time",
    "Out Time",
    "Normal (Hrs)",
    "Double (Hrs)",
    "Triple (Hrs)",
    "Approved (Hrs)",
    "Night",
    "Manual",
    "Status",
    "Decision Reason",
  ]);

  const sorted = [...entries].sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.employee.empId.localeCompare(b.employee.empId);
  });

  let alt = false;
  for (const e of sorted) {
    rows.push([
      e.employee.empId,
      e.employee.name,
      e.shift,
      e.inTime ?? "—",
      e.outTime ?? "—",
      fmt(e.normalMinutes),
      fmt(e.doubleMinutes),
      fmt(e.tripleMinutes),
      fmt(e.approvedTotalMinutes),
      e.isNight ? "1" : "",
      e.manualOverride ? "●" : "",
      e.status,
      e.decisionReason ?? "",
    ]);

    const rowIdx = rows.length;
    const style = alt ? ALT_ROW_STYLE : NORMAL_ROW_STYLE;
    for (let c = 0; c < 13; c++) {
      styleCell(ws, `${colLetter(c)}${rowIdx}`, style);
    }
    alt = !alt;
  }

  // Total row
  rows.push([
    "",
    "TOTAL",
    "",
    "",
    "",
    fmt(totalNormal),
    fmt(totalDouble),
    fmt(totalTriple),
    fmt(totalApproved),
    "",
    "",
    "",
    "",
  ]);
  const totalRowIdx = rows.length;
  for (let c = 0; c < 13; c++) {
    styleCell(ws, `${colLetter(c)}${totalRowIdx}`, SUMMARY_TOTAL_STYLE);
  }

  XLSX.utils.sheet_add_aoa(ws, rows, { origin: "A1" });

  styleCell(ws, "A1", {
    font: { bold: true, sz: 15, color: { rgb: "1E3A5F" } },
  });
  styleCell(ws, "A2", {
    font: { bold: true, sz: 12, color: { rgb: "2563EB" } },
  });
  for (let i = 4; i <= 6; i++) {
    styleCell(ws, `A${i}`, META_LABEL_STYLE);
    styleCell(ws, `B${i}`, META_VALUE_STYLE);
  }

  // Summary section header
  styleCell(ws, "A8", {
    font: { bold: true, sz: 10, color: { rgb: "1E3A5F" } },
    fill: { fgColor: { rgb: "EFF6FF" } },
  });

  // Table header row
  const hdrRow = tableStart + 1;
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"].forEach(
    (col) => {
      styleCell(ws, `${col}${hdrRow}`, HEADER_STYLE);
    },
  );

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 12 } },
  ];

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length, c: 12 },
  });
  setColWidths(ws, [10, 24, 10, 9, 9, 13, 13, 13, 14, 6, 7, 10, 20]);

  return ws;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "week";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status") ?? "ALL";
  const employeeId = searchParams.get("employeeId") ?? "";
  const companyName = searchParams.get("companyName") ?? "OTFlow";

  const { dateFrom, dateTo } = buildDateRange(range, from, to, new Date());

  const where: any = { workDate: { gte: dateFrom, lte: dateTo } };
  if (status !== "ALL") where.status = status;
  if (employeeId) where.employeeId = employeeId;

  const entries = await prisma.otEntry.findMany({
    where,
    include: {
      employee: { select: { name: true, empId: true } },
      decidedBy: { select: { username: true } },
    },
    orderBy: [{ employee: { empId: "asc" } }, { workDate: "asc" }],
  });

  const scopeLabel =
    range === "day"
      ? "DAILY"
      : range === "week"
        ? "WEEKLY"
        : range === "month"
          ? "MONTHLY"
          : range === "year"
            ? "YEARLY"
            : "CUSTOM";

  const meta = {
    scope: scopeLabel,
    dateFrom,
    dateTo,
    statusFilter: status === "ALL" ? "All" : status,
    companyName,
    generatedAt: new Date().toLocaleString(),
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(entries, meta), "Summary");

  if (range === "day") {
    XLSX.utils.book_append_sheet(
      wb,
      buildDailySheet(entries, meta),
      "Daily Records",
    );
  } else {
    XLSX.utils.book_append_sheet(
      wb,
      buildRecordsSheet(entries, meta),
      "Records",
    );
  }

  const buffer = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  });
  const filename = `OTFlow_${scopeLabel}_${dateFrom}_${dateTo}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
