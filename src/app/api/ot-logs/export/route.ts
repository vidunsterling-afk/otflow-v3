/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";

// ── Value helpers ─────────────────────────────────────────────────────────────
function toHrs(mins: number): number {
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
}

function fmt(mins: number): string | number {
  return mins > 0 ? toHrs(mins) : "";
}

function colLetter(n: number): string {
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
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

// ── Logo fetch/decode ────────────────────────────────────────────────────────
async function fetchCompanyLogo(
  req: NextRequest,
): Promise<{ logo: string | null; companyName: string } | null> {
  try {
    const url = new URL("/api/settings/logo", req.url);
    const res = await fetch(url, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function dataUrlToBuffer(
  dataUrl: string,
): { buffer: Buffer; extension: "png" | "jpeg" } | null {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const extension =
    match[1].toLowerCase() === "jpg"
      ? "jpeg"
      : (match[1].toLowerCase() as "png" | "jpeg");
  return { buffer: Buffer.from(match[2], "base64"), extension };
}

// ── Style helpers ────────────────────────────────────────────────────────────
const BORDER_COLOR = "FFE2E8F0";
const THIN = { style: "thin" as const, color: { argb: BORDER_COLOR } };
const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN,
  left: THIN,
  bottom: THIN,
  right: THIN,
};

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = CELL_BORDER;
}

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  applyBorder(cell);
}

function styleDataCell(cell: ExcelJS.Cell, alt: boolean) {
  cell.font = { size: 9, color: { argb: "FF1F2937" } };
  if (alt) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFF" },
    };
  }
  cell.alignment = { vertical: "middle" };
  applyBorder(cell);
}

function styleSubtotalCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 9, color: { argb: "FF1E3A5F" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDBEAFE" },
  };
  cell.alignment = { horizontal: "right", vertical: "middle" };
  applyBorder(cell);
}

function styleTotalCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 10, color: { argb: "FF1E3A5F" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6FF" },
  };
  applyBorder(cell);
}

function styleSectionHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 10, color: { argb: "FF1E3A5F" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6FF" },
  };
  applyBorder(cell);
}

interface ReportMeta {
  scope: string;
  dateFrom: string;
  dateTo: string;
  statusFilter: string;
  companyName: string;
  generatedAt: string;
}

function addTitleBlock(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  meta: ReportMeta,
  numCols: number,
  logoBuffer: Buffer | null,
  logoExt: "png" | "jpeg" | null,
  reportTitle: string,
) {
  const lastCol = colLetter(numCols - 1);
  const align = logoBuffer ? "right" : "left";

  ws.mergeCells(`A1:${lastCol}1`);
  ws.getRow(1).height = 34;
  const nameCell = ws.getCell("A1");
  nameCell.value = meta.companyName || "OTFlow";
  nameCell.font = { bold: true, size: 16, color: { argb: "FF1E3A5F" } };
  nameCell.alignment = { vertical: "middle", horizontal: align, indent: 1 };

  ws.mergeCells(`A2:${lastCol}2`);
  ws.getRow(2).height = 22;
  const titleCell = ws.getCell("A2");
  titleCell.value = reportTitle;
  titleCell.font = { bold: true, size: 12, color: { argb: "FF2563EB" } };
  titleCell.alignment = { vertical: "middle", horizontal: align, indent: 1 };

  if (logoBuffer && logoExt) {
    const imageId = wb.addImage({
      buffer: logoBuffer as unknown as ExcelJS.Buffer,
      extension: logoExt,
    });
    ws.addImage(imageId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 130, height: 46 },
    });
  }

  ws.addRow([]);

  const metaRows: [string, string][] = [
    ["Scope", meta.scope],
    ["Period", `${meta.dateFrom} → ${meta.dateTo}`],
    ["Status Filter", meta.statusFilter],
    ["Generated At", meta.generatedAt],
  ];
  for (const [label, value] of metaRows) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 9, color: { argb: "FF374151" } };
    row.getCell(2).font = { size: 9, color: { argb: "FF111827" } };
  }

  ws.addRow([]);
}

// ── SHEET 1: Summary ─────────────────────────────────────────────────────────
function buildSummarySheet(
  wb: ExcelJS.Workbook,
  entries: any[],
  meta: ReportMeta,
  logoBuffer: Buffer | null,
  logoExt: "png" | "jpeg" | null,
) {
  const ws = wb.addWorksheet("Summary");
  const NUM_COLS = 11;
  ws.columns = [12, 26, 8, 8, 10, 9, 14, 14, 14, 12, 14].map((w) => ({
    width: w,
  }));

  addTitleBlock(
    wb,
    ws,
    meta,
    NUM_COLS,
    logoBuffer,
    logoExt,
    "OVERTIME REPORT — SUMMARY",
  );

  const pending = entries.filter((e) => e.status === "PENDING").length;
  const approved = entries.filter((e) => e.status === "APPROVED").length;
  const rejected = entries.filter((e) => e.status === "REJECTED").length;
  const totalNormal = entries.reduce((s, e) => s + e.normalMinutes, 0);
  const totalDouble = entries.reduce((s, e) => s + e.doubleMinutes, 0);
  const totalTriple = entries.reduce((s, e) => s + e.tripleMinutes, 0);
  const totalApproved = entries.reduce((s, e) => s + e.approvedTotalMinutes, 0);

  const overallHeaderRow = ws.addRow(["OVERALL SUMMARY"]);
  ws.mergeCells(
    `A${overallHeaderRow.number}:${colLetter(NUM_COLS - 1)}${overallHeaderRow.number}`,
  );
  styleSectionHeaderCell(overallHeaderRow.getCell(1));

  const overallRows: [string, number][] = [
    ["Records", entries.length],
    ["Pending", pending],
    ["Approved", approved],
    ["Rejected", rejected],
    ["Normal OT (hrs)", toHrs(totalNormal)],
    ["Double OT (hrs)", toHrs(totalDouble)],
    ["Triple OT (hrs)", toHrs(totalTriple)],
    ["Total OT (hrs)", toHrs(totalNormal + totalDouble + totalTriple)],
    ["Approved Total (hrs)", toHrs(totalApproved)],
  ];
  for (const [label, value] of overallRows) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 9, color: { argb: "FF374151" } };
    row.getCell(2).font = { size: 9, color: { argb: "FF111827" } };
  }
  ws.addRow([]);

  const empSectionRow = ws.addRow(["EMPLOYEE-WISE SUMMARY"]);
  ws.mergeCells(
    `A${empSectionRow.number}:${colLetter(NUM_COLS - 1)}${empSectionRow.number}`,
  );
  styleSectionHeaderCell(empSectionRow.getCell(1));

  const headerRow = ws.addRow([
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
  headerRow.eachCell((cell) => styleHeaderCell(cell));

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

  let alt = false;
  for (const [, r] of empMap) {
    const row = ws.addRow([
      r.empId,
      r.name,
      r.count,
      r.pending,
      r.approved,
      r.rejected,
      toHrs(r.normal),
      toHrs(r.double),
      toHrs(r.triple),
      toHrs(r.normal + r.double + r.triple),
      toHrs(r.approvedMins),
    ]);
    row.eachCell((cell, colNum) => {
      styleDataCell(cell, alt);
      if (colNum >= 7) cell.numFmt = "0.00";
    });
    alt = !alt;
  }

  const totalRow = ws.addRow([
    "",
    "TOTAL",
    entries.length,
    pending,
    approved,
    rejected,
    toHrs(totalNormal),
    toHrs(totalDouble),
    toHrs(totalTriple),
    toHrs(totalNormal + totalDouble + totalTriple),
    toHrs(totalApproved),
  ]);
  totalRow.eachCell((cell, colNum) => {
    styleTotalCell(cell);
    if (colNum >= 7) cell.numFmt = "0.00";
  });

  ws.views = [{ state: "frozen", ySplit: headerRow.number }];
}

// ── SHEET 2: Employee-wise Records ────────────────────────────────────────────
function buildRecordsSheet(
  wb: ExcelJS.Workbook,
  entries: any[],
  meta: ReportMeta,
  logoBuffer: Buffer | null,
  logoExt: "png" | "jpeg" | null,
) {
  const ws = wb.addWorksheet("Records");
  const NUM_COLS = 12;
  ws.columns = [13, 10, 6, 9, 9, 13, 13, 13, 12, 13, 11, 20].map((w) => ({
    width: w,
  }));

  addTitleBlock(
    wb,
    ws,
    meta,
    NUM_COLS,
    logoBuffer,
    logoExt,
    "OVERTIME RECORDS — DETAILED",
  );

  const empMap = new Map<string, any[]>();
  for (const e of entries) {
    const key = e.employee.empId;
    if (!empMap.has(key)) empMap.set(key, []);
    empMap.get(key)!.push(e);
  }
  const sortedEmps = Array.from(empMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

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

  for (const [empId, empEntries] of sortedEmps) {
    const empName = empEntries[0].employee.name;

    const empHeaderRow = ws.addRow([`EMPLOYEE: ${empId} — ${empName}`]);
    ws.mergeCells(
      `A${empHeaderRow.number}:${colLetter(NUM_COLS - 1)}${empHeaderRow.number}`,
    );
    const empCell = empHeaderRow.getCell(1);
    empCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    empCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };
    empCell.alignment = { vertical: "middle", indent: 1 };
    applyBorder(empCell);

    const colHeaderRow = ws.addRow(COL_HEADERS);
    colHeaderRow.eachCell((cell) => styleHeaderCell(cell));

    let nightCount = 0;
    let subNormal = 0,
      subDouble = 0,
      subTriple = 0,
      subApproved = 0;
    let alt = false;

    for (const e of empEntries) {
      if (e.isNight) nightCount++;
      subNormal += e.normalMinutes;
      subDouble += e.doubleMinutes;
      subTriple += e.tripleMinutes;
      subApproved += e.approvedTotalMinutes;

      const row = ws.addRow([
        e.workDate,
        e.shift,
        e.isNight ? "1" : "",
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
      row.eachCell((cell, colNum) => {
        styleDataCell(cell, alt);
        if (colNum >= 6 && colNum <= 10 && typeof cell.value === "number") {
          cell.numFmt = "0.00";
        }
      });
      alt = !alt;
    }

    const subRow = ws.addRow([
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
    subRow.eachCell((cell, colNum) => {
      styleSubtotalCell(cell);
      if (colNum >= 6 && colNum <= 10 && typeof cell.value === "number") {
        cell.numFmt = "0.00";
      }
    });

    ws.addRow([]);
  }
}

// ── SHEET: Flat daily view (used for single-date exports) ─────────────────────
function buildDailySheet(
  wb: ExcelJS.Workbook,
  entries: any[],
  meta: ReportMeta,
  logoBuffer: Buffer | null,
  logoExt: "png" | "jpeg" | null,
) {
  const ws = wb.addWorksheet("Daily Records");
  const NUM_COLS = 13;
  ws.columns = [10, 24, 10, 9, 9, 13, 13, 13, 14, 6, 7, 10, 20].map((w) => ({
    width: w,
  }));

  addTitleBlock(
    wb,
    ws,
    meta,
    NUM_COLS,
    logoBuffer,
    logoExt,
    `DAILY OT REPORT — ${meta.dateFrom}`,
  );

  const totalNormal = entries.reduce((s, e) => s + e.normalMinutes, 0);
  const totalDouble = entries.reduce((s, e) => s + e.doubleMinutes, 0);
  const totalTriple = entries.reduce((s, e) => s + e.tripleMinutes, 0);
  const totalApproved = entries.reduce((s, e) => s + e.approvedTotalMinutes, 0);
  const pending = entries.filter((e) => e.status === "PENDING").length;
  const approved = entries.filter((e) => e.status === "APPROVED").length;
  const rejected = entries.filter((e) => e.status === "REJECTED").length;

  const summaryHeaderRow = ws.addRow(["SUMMARY"]);
  ws.mergeCells(
    `A${summaryHeaderRow.number}:${colLetter(NUM_COLS - 1)}${summaryHeaderRow.number}`,
  );
  styleSectionHeaderCell(summaryHeaderRow.getCell(1));

  const summaryRows: [string, number][] = [
    ["Total Entries", entries.length],
    ["Pending", pending],
    ["Approved", approved],
    ["Rejected", rejected],
    ["Normal OT (hrs)", toHrs(totalNormal)],
    ["Double OT (hrs)", toHrs(totalDouble)],
    ["Triple OT (hrs)", toHrs(totalTriple)],
    ["Approved OT (hrs)", toHrs(totalApproved)],
  ];
  for (const [label, value] of summaryRows) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 9, color: { argb: "FF374151" } };
    row.getCell(2).font = { size: 9, color: { argb: "FF111827" } };
  }
  ws.addRow([]);

  const headerRow = ws.addRow([
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
  headerRow.eachCell((cell) => styleHeaderCell(cell));

  const sorted = [...entries].sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.employee.empId.localeCompare(b.employee.empId);
  });

  let alt = false;
  for (const e of sorted) {
    const row = ws.addRow([
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
    row.eachCell((cell, colNum) => {
      styleDataCell(cell, alt);
      if (colNum >= 6 && colNum <= 9 && typeof cell.value === "number") {
        cell.numFmt = "0.00";
      }
    });
    alt = !alt;
  }

  const totalRow = ws.addRow([
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
  totalRow.eachCell((cell, colNum) => {
    styleTotalCell(cell);
    if (colNum >= 6 && colNum <= 9 && typeof cell.value === "number") {
      cell.numFmt = "0.00";
    }
  });

  ws.views = [{ state: "frozen", ySplit: headerRow.number }];
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
  const companyNameParam = searchParams.get("companyName") ?? "";

  const { dateFrom, dateTo } = buildDateRange(range, from, to, new Date());

  const where: any = { workDate: { gte: dateFrom, lte: dateTo } };
  if (status !== "ALL") where.status = status;
  if (employeeId) where.employeeId = employeeId;

  const [entries, settings] = await Promise.all([
    prisma.otEntry.findMany({
      where,
      include: {
        employee: { select: { name: true, empId: true } },
        decidedBy: { select: { username: true } },
      },
      orderBy: [{ employee: { empId: "asc" } }, { workDate: "asc" }],
    }),
    fetchCompanyLogo(req),
  ]);

  const companyName = companyNameParam || settings?.companyName || "OTFlow";
  const logoImage = settings?.logo ? dataUrlToBuffer(settings.logo) : null;

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

  const meta: ReportMeta = {
    scope: scopeLabel,
    dateFrom,
    dateTo,
    statusFilter: status === "ALL" ? "All" : status,
    companyName,
    generatedAt: new Date().toLocaleString(),
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "OTFlow";
  wb.created = new Date();

  buildSummarySheet(
    wb,
    entries,
    meta,
    logoImage?.buffer ?? null,
    logoImage?.extension ?? null,
  );

  if (range === "day") {
    buildDailySheet(
      wb,
      entries,
      meta,
      logoImage?.buffer ?? null,
      logoImage?.extension ?? null,
    );
  } else {
    buildRecordsSheet(
      wb,
      entries,
      meta,
      logoImage?.buffer ?? null,
      logoImage?.extension ?? null,
    );
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `OTFlow_${scopeLabel}_${dateFrom}_${dateTo}.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
