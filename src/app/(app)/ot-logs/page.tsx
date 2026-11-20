/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
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
  ScrollText,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMinutes, formatDate, getPageNumbers } from "@/lib/utils";
import { Input, Select } from "@/components/ui/FormField";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { LogoSettings } from "@/components/ot/LogoSettings";
import { format } from "date-fns";
import { Status } from "@/lib/types";
import "./ot-logs.css";

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

type SortKey =
  | "empId"
  | "employee"
  | "workDate"
  | "shift"
  | "normalMinutes"
  | "doubleMinutes"
  | "tripleMinutes"
  | "status"
  | "approvedTotalMinutes";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const SORT_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "empId", label: "Emp ID" },
  { key: "employee", label: "Employee" },
  { key: "workDate", label: "Date" },
  { key: "shift", label: "Shift" },
  { key: "normalMinutes", label: "Normal" },
  { key: "doubleMinutes", label: "Double" },
  { key: "tripleMinutes", label: "Triple" },
  { key: "status", label: "Status" },
  { key: "approvedTotalMinutes", label: "Approved OT" },
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

function sortValue(entry: LogEntry, key: SortKey): string | number {
  switch (key) {
    case "empId":
      return entry.employee.empId;
    case "employee":
      return entry.employee.name.toLowerCase();
    case "workDate":
      return entry.workDate;
    case "shift":
      return entry.shift;
    case "normalMinutes":
      return entry.normalMinutes;
    case "doubleMinutes":
      return entry.doubleMinutes;
    case "tripleMinutes":
      return entry.tripleMinutes;
    case "status":
      return entry.status;
    case "approvedTotalMinutes":
      return entry.approvedTotalMinutes;
  }
}

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: (typeof SORT_COLUMNS)[number];
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column.key;
  const Icon = !active
    ? ArrowUpDown
    : sort.dir === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <button
      className="logs-sort"
      data-active={active}
      onClick={() => onSort(column.key)}
    >
      {column.label}
      <Icon size={11} />
    </button>
  );
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
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<SortState>({
    key: "workDate",
    dir: "desc",
  });
  const [logoOpen, setLogoOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/logo")
      .then((r) => r.json())
      .then((d) => {
        if (d.companyName) setCompanyName(d.companyName);
        if (d.logo) setCompanyLogo(d.logo);
      })
      .catch(() => {});
  }, []);

  const empSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const queryParams = new URLSearchParams({
    range,
    status,
    page: String(page),
    pageSize: String(pageSize),
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
    if (empSearchTimeout.current) clearTimeout(empSearchTimeout.current);
    if (!q) {
      setEmpResults([]);
      return;
    }
    empSearchTimeout.current = setTimeout(async () => {
      const res = await fetch(
        `/api/employees/search?q=${encodeURIComponent(q)}`,
      );
      const result = await res.json();
      setEmpResults(result);
      setShowEmpDrop(true);
    }, 250);
  }

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  const sortedEntries = [...(data?.entries ?? [])].sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

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
      a.download = "OTFlow_Export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready");
    } catch {
      toast.error("Export failed");
    }
  }

  function clearAllFilters() {
    setRange("week");
    setDailyDate(format(new Date(), "yyyy-MM-dd"));
    setCustomFrom("");
    setCustomTo("");
    setStatus("ALL");
    setSelectedEmp(null);
    setEmpSearch("");
    setEmpResults([]);
    setPage(1);
  }

  const activeFilters: Array<{ id: string; label: string; clear: () => void }> =
    [];
  if (range !== "week") {
    activeFilters.push({
      id: "range",
      label: `Range: ${RANGES.find((r) => r.value === range)?.label ?? range}`,
      clear: () => {
        setRange("week");
        setPage(1);
      },
    });
  }
  if (range === "day" && dailyDate) {
    activeFilters.push({
      id: "date",
      label: `Date: ${dailyDate}`,
      clear: () => {
        setDailyDate(format(new Date(), "yyyy-MM-dd"));
        setPage(1);
      },
    });
  }
  if (range === "custom" && customFrom) {
    activeFilters.push({
      id: "from",
      label: `From: ${customFrom}`,
      clear: () => {
        setCustomFrom("");
        setPage(1);
      },
    });
  }
  if (range === "custom" && customTo) {
    activeFilters.push({
      id: "to",
      label: `To: ${customTo}`,
      clear: () => {
        setCustomTo("");
        setPage(1);
      },
    });
  }
  if (status !== "ALL") {
    activeFilters.push({
      id: "status",
      label: `Status: ${status}`,
      clear: () => {
        setStatus("ALL");
        setPage(1);
      },
    });
  }
  if (selectedEmp) {
    activeFilters.push({
      id: "employee",
      label: `Employee: ${selectedEmp.name}`,
      clear: () => {
        setSelectedEmp(null);
        setEmpSearch("");
        setPage(1);
      },
    });
  }

  const agg = data?.aggregates;
  const kpis = [
    {
      title: "Volume",
      items: [
        {
          label: "Total entries",
          value: agg?.totalEntries ?? 0,
          icon: Clock,
          color: "var(--brand-600)",
          bg: "var(--brand-50)",
          featured: false,
        },
      ],
    },
    {
      title: "Decisions",
      items: [
        {
          label: "Pending",
          value: data?.statusCounts?.PENDING ?? 0,
          icon: AlertCircle,
          color: "var(--status-pending-text)",
          bg: "var(--status-pending-bg)",
          featured: false,
        },
        {
          label: "Approved",
          value: data?.statusCounts?.APPROVED ?? 0,
          icon: CheckCircle2,
          color: "var(--status-approved-text)",
          bg: "var(--status-approved-bg)",
          featured: false,
        },
        {
          label: "Rejected",
          value: data?.statusCounts?.REJECTED ?? 0,
          icon: XCircle,
          color: "var(--status-rejected-text)",
          bg: "var(--status-rejected-bg)",
          featured: false,
        },
      ],
    },
    {
      title: "Overtime",
      items: [
        {
          label: "Normal",
          value: formatMinutes(agg?.totalNormalMinutes ?? 0),
          icon: Timer,
          color: "var(--brand-600)",
          bg: "var(--brand-50)",
          featured: false,
        },
        {
          label: "Double",
          value: formatMinutes(agg?.totalDoubleMinutes ?? 0),
          icon: Timer,
          color: "var(--brand-600)",
          bg: "var(--brand-50)",
          featured: false,
        },
        {
          label: "Triple",
          value: formatMinutes(agg?.totalTripleMinutes ?? 0),
          icon: Timer,
          color: "var(--brand-700)",
          bg: "var(--brand-100)",
          featured: false,
        },
        {
          label: "Approved OT",
          value: formatMinutes(agg?.totalApprovedMinutes ?? 0),
          icon: CheckCircle2,
          color: "var(--brand-700)",
          bg: "var(--brand-50)",
          featured: true,
        },
      ],
    },
  ];

  return (
    <div className="logs-page">
      {/* Header */}
      <div className="logs-head">
        <div>
          <div className="logs-head__eyebrow">Reports</div>
          <h1 className="logs-head__title">
            <span className="logs-head__icon">
              <ScrollText size={18} />
            </span>
            OT Logs
          </h1>
          <div className="logs-head__sub">
            {data
              ? `${data.dateFrom} → ${data.dateTo} · ${data.total} entries`
              : "Loading report..."}
          </div>
        </div>
        <div className="logs-head__actions no-print">
          <button className="logs-btn" onClick={() => setLogoOpen(true)}>
            <Building2 size={14} />
            Company
          </button>
          <button className="logs-btn" onClick={() => window.print()}>
            <Printer size={14} />
            Print
          </button>
          {canExport && (
            <button
              className="logs-btn logs-btn--primary"
              onClick={handleExport}
            >
              <Download size={14} />
              Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <motion.div
        className="logs-filters no-print"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="logs-filters__head">
          <div className="logs-filters__title">
            <span className="logs-filters__icon">
              <Filter size={14} />
            </span>
            Filters
          </div>
          {activeFilters.length > 0 && (
            <button className="logs-clear" onClick={clearAllFilters}>
              <X size={12} />
              Clear all
            </button>
          )}
        </div>

        <div className="logs-range">
          {RANGES.map((r) => (
            <button
              key={r.value}
              className="logs-range__tab"
              data-active={range === r.value}
              onClick={() => {
                setRange(r.value);
                setPage(1);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="logs-filter-grid">
          {range === "day" && (
            <div className="logs-field">
              <span className="logs-field__label">Select date</span>
              <div className="logs-field__row">
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
                  className="logs-btn"
                  onClick={() => {
                    setDailyDate(format(new Date(), "yyyy-MM-dd"));
                    setPage(1);
                  }}
                >
                  Today
                </button>
                {dailyDate && (
                  <span className="logs-field__note">
                    {new Date(dailyDate + "T00:00:00Z").toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      },
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          {range === "custom" && (
            <>
              <div className="logs-field">
                <span className="logs-field__label">From</span>
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
              <div className="logs-field">
                <span className="logs-field__label">To</span>
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
            </>
          )}

          <div className="logs-field">
            <span className="logs-field__label">Status</span>
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

          <div className="logs-field">
            <span className="logs-field__label">Employee</span>
            <div className="logs-employee">
              {selectedEmp ? (
                <div className="logs-employee__selected">
                  <span>{selectedEmp.name}</span>
                  <button
                    className="logs-employee__remove"
                    onClick={() => {
                      setSelectedEmp(null);
                      setEmpSearch("");
                      setPage(1);
                    }}
                    aria-label="Clear employee filter"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <Search size={13} className="logs-employee__icon" />
                  <input
                    className="logs-employee__input"
                    value={empSearch}
                    onChange={(e) => searchEmployees(e.target.value)}
                    onFocus={() =>
                      empResults.length > 0 && setShowEmpDrop(true)
                    }
                    onBlur={() =>
                      setTimeout(() => setShowEmpDrop(false), 150)
                    }
                    placeholder="Search employee..."
                    aria-label="Search employee"
                  />
                  {showEmpDrop && empResults.length > 0 && (
                    <div className="logs-employee__menu">
                      {empResults.map((emp) => (
                        <button
                          key={emp.id}
                          className="logs-employee__option"
                          onClick={() => {
                            setSelectedEmp(emp);
                            setShowEmpDrop(false);
                            setPage(1);
                          }}
                        >
                          <span>{emp.name}</span>
                          <span>#{emp.empId}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="logs-active">
            <span className="logs-active__label">Active</span>
            {activeFilters.map((filter) => (
              <span key={filter.id} className="logs-chip">
                {filter.label}
                <button onClick={filter.clear} aria-label="Remove filter">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* KPIs */}
      <div className="logs-kpis">
        {kpis.map((group) => (
          <motion.div
            key={group.title}
            className="logs-kpi-group"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="logs-kpi-group__title">{group.title}</div>
            <div className="logs-kpi-group__items">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`logs-kpi${item.featured ? " logs-kpi--featured" : ""}`}
                  >
                    <span
                      className="logs-kpi__icon"
                      style={{ background: item.bg, color: item.color }}
                    >
                      <Icon size={14} />
                    </span>
                    <span>
                      <span className="logs-kpi__label">{item.label}</span>
                      <span
                        className="logs-kpi__value"
                        style={{ display: "block" }}
                      >
                        {item.value}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Report table */}
      <div id="print-area">
        <div className="logs-print-header">
          {companyLogo && <img src={companyLogo} alt="Company logo" />}
          <div>
            <h1>{companyName || "OTFlow"} — OT Logs</h1>
            <p>
              {data?.dateFrom} to {data?.dateTo} · {data?.total ?? 0} entries ·
              Approved OT {formatMinutes(agg?.totalApprovedMinutes ?? 0)}
            </p>
          </div>
        </div>

        <div className="logs-table-card">
          <div className="logs-table-scroll">
            <div className="logs-table">
              <div className="logs-head-row">
                {SORT_COLUMNS.map((column) => (
                  <SortHeader
                    key={column.key}
                    column={column}
                    sort={sort}
                    onSort={handleSort}
                  />
                ))}
              </div>

              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="logs-skeleton-row">
                    {SORT_COLUMNS.map((column) => (
                      <span key={column.key} className="logs-skeleton" />
                    ))}
                  </div>
                ))
              ) : sortedEntries.length === 0 ? (
                <div className="logs-empty">
                  <span className="logs-empty__icon">
                    <Search size={20} />
                  </span>
                  <span className="logs-empty__title">No entries found</span>
                  <span className="logs-empty__sub">
                    Try widening the date range or clearing your filters.
                  </span>
                  <button className="logs-btn" onClick={clearAllFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                sortedEntries.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    className="logs-row"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  >
                    <div>
                      <span className="logs-emp-id">{entry.employee.empId}</span>
                    </div>
                    <div>
                      <div className="logs-name">{entry.employee.name}</div>
                      <div className="logs-meta">
                        {entry.inTime && (
                          <span>
                            {entry.inTime} – {entry.outTime}
                          </span>
                        )}
                        {entry.isNight && (
                          <span className="logs-tag" data-kind="night">
                            <Moon size={10} /> Night
                          </span>
                        )}
                        {entry.manualOverride && (
                          <span className="logs-tag" data-kind="manual">
                            <AlertTriangle size={10} /> Manual
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                      {formatDate(entry.workDate)}
                    </div>
                    <div>
                      <span className="logs-shift">{entry.shift}</span>
                    </div>
                    <div className="logs-number">
                      {entry.normalMinutes > 0
                        ? formatMinutes(entry.normalMinutes)
                        : "—"}
                    </div>
                    <div className="logs-number">
                      {entry.doubleMinutes > 0
                        ? formatMinutes(entry.doubleMinutes)
                        : "—"}
                    </div>
                    <div className="logs-number">
                      {entry.tripleMinutes > 0
                        ? formatMinutes(entry.tripleMinutes)
                        : "—"}
                    </div>
                    <div className="logs-status-cell">
                      <StatusBadge status={entry.status} iconWithText />
                      {(entry.decidedBy || entry.decisionReason) && (
                        <span
                          className="logs-decision"
                          title={
                            entry.decisionReason ?? entry.reason ?? undefined
                          }
                        >
                          {entry.decidedBy?.username ?? "—"}
                          {entry.decidedAt &&
                            ` · ${format(new Date(entry.decidedAt), "dd MMM")}`}
                          {entry.decisionReason && " · reason"}
                        </span>
                      )}
                    </div>
                    <div className="logs-number logs-number--total">
                      {entry.approvedTotalMinutes > 0
                        ? formatMinutes(entry.approvedTotalMinutes)
                        : "—"}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="logs-mobile">
            {sortedEntries.map((entry) => (
              <div key={entry.id} className="logs-mobile__card">
                <div className="logs-mobile__top">
                  <span className="logs-emp-id">{entry.employee.empId}</span>
                  <div className="logs-mobile__body">
                    <div className="logs-name">{entry.employee.name}</div>
                    <div className="logs-mobile__date">
                      {formatDate(entry.workDate)} · {entry.shift}
                    </div>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>
                <div className="logs-mobile__numbers">
                  <span>Normal {formatMinutes(entry.normalMinutes)}</span>
                  <span>Double {formatMinutes(entry.doubleMinutes)}</span>
                  <span>Triple {formatMinutes(entry.tripleMinutes)}</span>
                  <span>
                    Approved {formatMinutes(entry.approvedTotalMinutes)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="logs-pagination no-print">
          <span className="logs-pagination__info">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, data.total)} of {data.total} entries
          </span>
          <div className="logs-pagination__right">
            <label className="logs-page-size">
              Rows
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <div className="logs-pages">
              <button
                className="logs-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={14} />
              </button>
              {getPageNumbers(page, data.totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="logs-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className="logs-page-btn"
                    data-active={page === p}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                className="logs-page-btn"
                onClick={() =>
                  setPage((p) => Math.min(data.totalPages, p + 1))
                }
                disabled={page === data.totalPages}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <LogoSettings
        open={logoOpen}
        onClose={() => setLogoOpen(false)}
        onSaved={(name) => setCompanyName(name)}
      />
    </div>
  );
}
