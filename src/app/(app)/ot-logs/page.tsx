/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Download,
  Printer,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  Moon,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatMinutes, formatDate } from "@/lib/utils";
import { Input, Select } from "@/components/ui/FormField";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { LogoSettings } from "@/components/ot/LogoSettings";
import { Building2 } from "lucide-react";
import { format } from "date-fns";
import { Status } from "@/lib/types";

const RANGES = [
  { value: "day", label: "Daily" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

const STATUSES = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

interface Employee {
  id: string;
  empId: string;
  name: string;
}

interface LogEntry {
  id: string;
  workDate: string;
  shift: string;
  inTime?: string | null;
  outTime?: string | null;
  normalMinutes: number;
  doubleMinutes: number;
  tripleMinutes: number;
  approvedTotalMinutes: number;
  isNight: boolean;
  manualOverride: boolean;
  status: Status;
  decisionReason?: string | null;
  reason?: string | null;
  decidedAt?: string | null;
  employee: { name: string; empId: string };
  decidedBy?: { username: string } | null;
}

interface LogsResponse {
  entries: LogEntry[];
  total: number;
  page: number;
  totalPages: number;
  dateFrom: string;
  dateTo: string;
  aggregates: {
    totalNormalMinutes: number;
    totalDoubleMinutes: number;
    totalTripleMinutes: number;
    totalApprovedMinutes: number;
    totalEntries: number;
  };
  statusCounts: Record<string, number>;
}

export default function OtLogsPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as any)?.permissions ?? [];
  const canExport = permissions.includes("logs:export");

  const [range, setRange] = useState("week");
  const [customFrom, setCustomFrom] = useState("");
  const [dailyDate, setDailyDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState("");
  const [status, setStatus] = useState("ALL");
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [empResults, setEmpResults] = useState<Employee[]>([]);
  const [showEmpDrop, setShowEmpDrop] = useState(false);
  const [page, setPage] = useState(1);
  const [logoOpen, setLogoOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");

  // Load saved company name on mount
  useEffect(() => {
    fetch("/api/settings/logo")
      .then((r) => r.json())
      .then((d) => {
        if (d.companyName) setCompanyName(d.companyName);
      });
  }, []);
  const empSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const queryParams = new URLSearchParams({
    range,
    status,
    page: String(page),
    pageSize: "50",
    ...(selectedEmp ? { employeeId: selectedEmp.id } : {}),
    ...(range === "day" ? { from: dailyDate } : {}),
    ...(range === "custom" && customFrom ? { from: customFrom } : {}),
    ...(range === "custom" && customTo ? { to: customTo } : {}),
  }).toString();

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ["ot-logs", queryParams],
    queryFn: () => fetch(`/api/ot-logs?${queryParams}`).then((r) => r.json()),
    placeholderData: (prev) => prev,
  });

  function searchEmployees(q: string) {
    setEmpSearch(q);
    if (empSearchTimeout.current) {
      clearTimeout(empSearchTimeout.current);
    }
    if (!q) {
      setEmpResults([]);
      return;
    }
    empSearchTimeout.current = setTimeout(async () => {
      const res = await fetch(
        `/api/employees/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setEmpResults(data);
      setShowEmpDrop(true);
    }, 250);
  }

  async function handleExport() {
    if (!canExport) {
      toast.error("No permission to export");
      return;
    }
    toast.info("Preparing export...");
    try {
      const params = new URLSearchParams({
        range,
        status,
        companyName,
        ...(selectedEmp ? { employeeId: selectedEmp.id } : {}),
        ...(range === "day" ? { from: dailyDate } : {}),
        ...(range === "custom" && customFrom ? { from: customFrom } : {}),
        ...(range === "custom" && customTo ? { to: customTo } : {}),
      }).toString();
      const res = await fetch(`/api/ot-logs/export?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OTFlow_Export.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready");
    } catch {
      toast.error("Export failed");
    }
  }

  function handlePrint() {
    window.print();
  }

  const agg = data?.aggregates;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.5px",
              }}
            >
              OT Logs
            </div>
            <div
              style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}
            >
              {data
                ? `${data.dateFrom} → ${data.dateTo} · ${data.total} entries`
                : "Loading..."}
            </div>
          </div>
          <div className="no-print" style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setLogoOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 14px",
                height: 34,
                border: "1px solid var(--border-base)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-card)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--bg-muted)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--bg-card)")
              }
            >
              <Building2 size={14} /> Company
            </button>
            {canExport && (
              <button
                onClick={handleExport}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 14px",
                  height: 34,
                  border: "1px solid var(--border-base)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-card)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "var(--bg-muted)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    "var(--bg-card)")
                }
              >
                <Download size={14} /> Export Excel
              </button>
            )}
            <button
              onClick={handlePrint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 14px",
                height: 34,
                border: "1px solid var(--border-base)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-card)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--bg-muted)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--bg-card)")
              }
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="no-print"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          <SectionHeader title="Filters" icon={Filter} />

          {/* Range tabs */}
          <div
            style={{ width: "100%", display: "flex", gap: 6, flexWrap: "wrap" }}
          >
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => {
                  setRange(r.value);
                  setPage(1);
                }}
                style={{
                  padding: "5px 14px",
                  borderRadius: 99,
                  border: `1px solid ${range === r.value ? "var(--brand-300)" : "var(--border-base)"}`,
                  background:
                    range === r.value ? "var(--brand-50)" : "transparent",
                  color:
                    range === r.value
                      ? "var(--brand-600)"
                      : "var(--text-secondary)",
                  fontSize: 12.5,
                  fontWeight: range === r.value ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Daily date picker */}
          {range === "day" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                    fontWeight: 500,
                  }}
                >
                  Select Date
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Input
                    type="date"
                    value={dailyDate}
                    onChange={(e) => {
                      setDailyDate(e.target.value);
                      setPage(1);
                    }}
                    style={{ width: 170 }}
                  />
                  <button
                    onClick={() => {
                      setDailyDate(format(new Date(), "yyyy-MM-dd"));
                      setPage(1);
                    }}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-base)",
                      background: "var(--bg-card)",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "var(--bg-muted)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "var(--bg-card)")
                    }
                  >
                    Today
                  </button>
                </div>
              </div>
              {dailyDate && (
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--brand-50)",
                    border: "1px solid var(--brand-100)",
                    fontSize: 12.5,
                    color: "var(--brand-700)",
                    fontWeight: 500,
                    alignSelf: "flex-end",
                    marginBottom: 1,
                  }}
                >
                  {new Date(dailyDate + "T00:00:00Z").toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    },
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Custom date range */}
          {range === "custom" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  From
                </div>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: 160 }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  To
                </div>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: 160 }}
                />
              </div>
            </div>
          )}

          {/* Status + Employee filter row */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                Status
              </div>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                style={{ width: 160 }}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Employee filter */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                Employee
              </div>
              {selectedEmp ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    border: "1px solid var(--border-base)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-muted)",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{ color: "var(--text-primary)", fontWeight: 500 }}
                  >
                    {selectedEmp.name}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedEmp(null);
                      setEmpSearch("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      display: "flex",
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        left: 9,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                      }}
                    />
                    <input
                      value={empSearch}
                      onChange={(e) => searchEmployees(e.target.value)}
                      onFocus={() =>
                        empResults.length > 0 && setShowEmpDrop(true)
                      }
                      onBlur={() =>
                        setTimeout(() => setShowEmpDrop(false), 150)
                      }
                      placeholder="Search employee..."
                      style={{
                        paddingLeft: 28,
                        paddingRight: 10,
                        paddingTop: 7,
                        paddingBottom: 7,
                        border: "1px solid var(--border-base)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 13,
                        color: "var(--text-primary)",
                        background: "var(--bg-base)",
                        outline: "none",
                        width: 200,
                      }}
                    />
                  </div>
                  {showEmpDrop && empResults.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        width: 240,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-base)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-dropdown)",
                        zIndex: 100,
                        overflow: "hidden",
                      }}
                    >
                      {empResults.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmp(emp);
                            setShowEmpDrop(false);
                            setPage(1);
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: 13,
                            color: "var(--text-primary)",
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "var(--bg-muted)")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLElement).style.background =
                              "none")
                          }
                        >
                          <span style={{ fontWeight: 500 }}>{emp.name}</span>
                          <span
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                          >
                            #{emp.empId}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Aggregates */}
        {agg && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {[
              {
                label: "Total Entries",
                value: agg.totalEntries,
                icon: Clock,
                color: "var(--brand-500)",
                bg: "var(--brand-50)",
              },
              {
                label: "Pending",
                value: data?.statusCounts?.PENDING ?? 0,
                icon: AlertCircle,
                color: "var(--status-pending-text)",
                bg: "var(--status-pending-bg)",
              },
              {
                label: "Approved",
                value: data?.statusCounts?.APPROVED ?? 0,
                icon: CheckCircle2,
                color: "var(--status-approved-text)",
                bg: "var(--status-approved-bg)",
              },
              {
                label: "Rejected",
                value: data?.statusCounts?.REJECTED ?? 0,
                icon: XCircle,
                color: "var(--status-rejected-text)",
                bg: "var(--status-rejected-bg)",
              },
              {
                label: "Normal OT",
                value: formatMinutes(agg.totalNormalMinutes),
                icon: Timer,
                color: "var(--brand-500)",
                bg: "var(--brand-50)",
              },
              {
                label: "Double OT",
                value: formatMinutes(agg.totalDoubleMinutes),
                icon: Timer,
                color: "var(--brand-600)",
                bg: "var(--brand-50)",
              },
              {
                label: "Triple OT",
                value: formatMinutes(agg.totalTripleMinutes),
                icon: Timer,
                color: "var(--brand-700)",
                bg: "var(--brand-100)",
              },
              {
                label: "Approved OT",
                value: formatMinutes(agg.totalApprovedMinutes),
                icon: CheckCircle2,
                color: "var(--status-approved-text)",
                bg: "var(--status-approved-bg)",
              },
            ].map(({ label, value, icon: Icon, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-base)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  boxShadow: "var(--shadow-card)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-sm)",
                    background: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} color={color} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      letterSpacing: "-0.3px",
                    }}
                  >
                    {value}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Table */}
        <div id="print-area" ref={printRef}>
          {/* Print header */}
          <div style={{ display: "none" }} className="print-header">
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              OTFlow — OT Logs
            </h1>
            <p style={{ fontSize: 12, color: "#666" }}>
              {data?.dateFrom} to {data?.dateTo} · Exported{" "}
              {new Date().toLocaleDateString()}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "90px 1fr 100px 120px 80px 80px 80px 100px 110px",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border-base)",
                background: "var(--bg-muted)",
              }}
            >
              {[
                "Emp ID",
                "Employee",
                "Date",
                "Shift",
                "Normal",
                "Double",
                "Triple",
                "Status",
                "Approved OT",
              ].map((h) => (
                <div
                  key={h}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            {isLoading && (
              <div
                style={{
                  padding: "48px 0",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                Loading entries...
              </div>
            )}

            {!isLoading && (!data?.entries || data.entries.length === 0) && (
              <div
                style={{
                  padding: "48px 0",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No entries found for the selected filters
              </div>
            )}

            {!isLoading &&
              data?.entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "90px 1fr 100px 120px 80px 80px 80px 120px 110px",
                    padding: "12px 16px",
                    borderBottom:
                      i < data.entries.length - 1
                        ? "1px solid var(--border-base)"
                        : "none",
                    alignItems: "center",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--bg-muted)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  {/* Employee ID */}
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "var(--brand-50)",
                        border: "1px solid var(--brand-200)",
                        color: "var(--brand-600)",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {entry.employee.empId}
                    </span>
                  </div>

                  {/* Employee */}
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {entry.employee.name}
                    </div>

                    <div
                      style={{
                        marginTop: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                        fontSize: 11,
                        color: "var(--text-muted)",
                      }}
                    >
                      {entry.inTime && (
                        <span>
                          {entry.inTime} – {entry.outTime}
                        </span>
                      )}

                      {entry.isNight && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "rgba(99,102,241,.10)",
                            border: "1px solid rgba(99,102,241,.2)",
                          }}
                        >
                          <Moon size={10} />
                          Night
                        </span>
                      )}

                      {entry.manualOverride && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "var(--status-pending-bg)",
                            border: "1px solid var(--status-pending-border)",
                            color: "var(--status-pending-text)",
                          }}
                        >
                          <AlertTriangle size={10} />
                          Manual
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      fontWeight: 500,
                    }}
                  >
                    {formatDate(entry.workDate)}
                  </div>

                  {/* Shift */}
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "var(--bg-muted)",
                        border: "1px solid var(--border-base)",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {entry.shift}
                    </span>
                  </div>

                  {/* Normal */}
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {entry.normalMinutes > 0
                      ? formatMinutes(entry.normalMinutes)
                      : "—"}
                  </div>

                  {/* Double */}
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {entry.doubleMinutes > 0
                      ? formatMinutes(entry.doubleMinutes)
                      : "—"}
                  </div>

                  {/* Triple */}
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {entry.tripleMinutes > 0
                      ? formatMinutes(entry.tripleMinutes)
                      : "—"}
                  </div>

                  {/* Status */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <StatusBadge status={entry.status} iconWithText />
                  </div>

                  {/* Approved */}
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {entry.approvedTotalMinutes > 0
                      ? formatMinutes(entry.approvedTotalMinutes)
                      : "—"}
                  </div>
                </motion.div>
              ))}
          </motion.div>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div
            className="no-print"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, data.total)} of{" "}
              {data.total} entries
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-base)",
                  background: "var(--bg-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  opacity: page === 1 ? 0.4 : 1,
                  color: "var(--text-secondary)",
                }}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${page === p ? "var(--brand-300)" : "var(--border-base)"}`,
                      background:
                        page === p ? "var(--brand-50)" : "var(--bg-card)",
                      color:
                        page === p
                          ? "var(--brand-600)"
                          : "var(--text-secondary)",
                      fontSize: 12.5,
                      fontWeight: page === p ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-base)",
                  background: "var(--bg-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: page === data.totalPages ? "not-allowed" : "pointer",
                  opacity: page === data.totalPages ? 0.4 : 1,
                  color: "var(--text-secondary)",
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logo Settings Modal */}
      <LogoSettings
        open={logoOpen}
        onClose={() => setLogoOpen(false)}
        onSaved={(name) => setCompanyName(name)}
      />
    </>
  );
}
