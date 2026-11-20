/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useCallback, useReducer, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Clock,
  Moon,
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Square,
  Users,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getWeekDates, formatDate, formatMinutes } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddEntryModal } from "@/components/ot/AddEntryModal";
import {
  ApproveModal,
  RejectModal,
  EditEntryModal,
  BulkApproveModal,
} from "@/components/ot/EntryActionModals";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Status } from "@/lib/types";
import "./ot-entries.css";

interface OtEntry {
  id: string;
  workDate: string;
  shift: string;
  inTime?: string | null;
  outTime?: string | null;
  reason?: string | null;
  normalMinutes: number;
  doubleMinutes: number;
  tripleMinutes: number;
  isNight: boolean;
  status: Status;
  manualOverride: boolean;
  approvedTotalMinutes: number;
  employee: { name: string; empId: string };
}

interface DaySummary {
  workDate: string;
  status: string;
  _count: { _all: number };
}

type StatusFilter = "ALL" | Status;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Animation variants ────────────────────────────────────────────

const weekGridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

const dayCardVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: EASE },
  },
};

const entryListVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

const entryRowVariants: Variants = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE } },
};

// ─── Selection reducer (O(1) add/remove/has via Set) ──────────────

type SelectionAction =
  | { type: "TOGGLE"; id: string }
  | { type: "SELECT_ALL"; ids: string[] }
  | { type: "CLEAR" }
  | { type: "REMOVE_IDS"; ids: string[] };

function selectionReducer(
  state: Set<string>,
  action: SelectionAction,
): Set<string> {
  switch (action.type) {
    case "TOGGLE": {
      const next = new Set(state);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return next;
    }
    case "SELECT_ALL":
      return new Set(action.ids);
    case "CLEAR":
      return new Set();
    case "REMOVE_IDS": {
      const next = new Set(state);
      action.ids.forEach((id) => next.delete(id));
      return next;
    }
    default:
      return state;
  }
}

function entryTotalMinutes(entry: OtEntry): number {
  if (entry.status === "APPROVED") return entry.approvedTotalMinutes;
  return entry.normalMinutes + entry.doubleMinutes * 2 + entry.tripleMinutes * 3;
}

const STATUS_RANK: Record<Status, number> = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
};

export default function OtEntriesPage() {
  const { data: session } = useSession();
  const permissions =
    (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const canApprove = permissions.includes("ot:approve");
  const canEdit = permissions.includes("ot:edit");

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [approveEntry, setApproveEntry] = useState<OtEntry | null>(null);
  const [rejectEntry, setRejectEntry] = useState<OtEntry | null>(null);
  const [editEntry, setEditEntry] = useState<OtEntry | null>(null);

  const [selectedIds, dispatchSelection] = useReducer(
    selectionReducer,
    new Set<string>(),
  );
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(
    null,
  );

  const queryClient = useQueryClient();

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(baseDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setSelectedDate(today >= weekStart && today <= weekEnd ? today : weekStart);
    setStatusFilter("ALL");
    setSearch("");
    dispatchSelection({ type: "CLEAR" });
  }, [weekStart, weekEnd, today]);

  const { data: weekSummary = [], isFetching: weekFetching } = useQuery<
    DaySummary[]
  >({
    queryKey: ["ot-week", weekStart],
    queryFn: () =>
      fetch(`/api/ot-entries?weekStart=${weekStart}&weekEnd=${weekEnd}`).then(
        (r) => r.json(),
      ),
    staleTime: 60000,
  });

  const { data: dayEntries = [], isLoading: dayLoading } = useQuery<OtEntry[]>({
    queryKey: ["ot-day", selectedDate],
    queryFn: () =>
      fetch(`/api/ot-entries?date=${selectedDate}`).then((r) => r.json()),
    enabled: !!selectedDate,
  });

  const { data: empCountData } = useQuery<{ count: number }>({
    queryKey: ["employee-count"],
    queryFn: () => fetch("/api/employees/count").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const totalEmployees = empCountData?.count ?? 0;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["ot-week", weekStart] });
    queryClient.invalidateQueries({ queryKey: ["ot-day", selectedDate] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }, [queryClient, weekStart, selectedDate]);

  function getDayCounts(date: string) {
    const rows = weekSummary.filter(
      (r: { workDate: string }) => r.workDate === date,
    );
    const pending =
      rows.find((r: { status: string }) => r.status === "PENDING")?._count
        ._all ?? 0;
    const approved =
      rows.find((r: { status: string }) => r.status === "APPROVED")?._count
        ._all ?? 0;
    const rejected =
      rows.find((r: { status: string }) => r.status === "REJECTED")?._count
        ._all ?? 0;
    return { pending, approved, rejected, total: pending + approved + rejected };
  }

  const weekCounts = weekDates.reduce(
    (acc, date) => {
      const counts = getDayCounts(date);
      acc.total += counts.total;
      acc.pending += counts.pending;
      acc.approved += counts.approved;
      return acc;
    },
    { total: 0, pending: 0, approved: 0 },
  );

  async function handleDelete(id: string) {
    if (!confirm("Delete this OT entry?")) return;
    try {
      const res = await fetch(`/api/ot-entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Entry deleted");
      refresh();
    } catch {
      toast.error("Failed to delete entry");
    }
  }

  function handleBulkSuccess(succeededIds: string[]) {
    dispatchSelection({ type: "REMOVE_IDS", ids: succeededIds });
    refresh();
  }

  const pendingEntries = dayEntries.filter((e) => e.status === "PENDING");
  const pendingIds = pendingEntries.map((e) => e.id);
  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));

  const selectedCount = selectedIds.size;
  const showBulkToolbar = canApprove && selectedCount > 0;
  const missingCount =
    selectedDate && totalEmployees > 0 && !dayLoading
      ? Math.max(0, totalEmployees - dayEntries.length)
      : 0;
  const isDayIncomplete = missingCount > 0;

  const dayPending = pendingEntries.length;
  const dayApproved = dayEntries.filter((e) => e.status === "APPROVED").length;
  const dayTotalMinutes = dayEntries.reduce(
    (sum, entry) => sum + entryTotalMinutes(entry),
    0,
  );

  const searchTerm = search.trim().toLowerCase();
  const visibleEntries = dayEntries
    .filter(
      (entry) => statusFilter === "ALL" || entry.status === statusFilter,
    )
    .filter((entry) =>
      searchTerm
        ? `${entry.employee.name} ${entry.employee.empId} ${entry.shift}`
            .toLowerCase()
            .includes(searchTerm)
        : true,
    )
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  const tabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: "ALL", label: "All", count: dayEntries.length },
    { key: "PENDING", label: "Pending", count: dayPending },
    { key: "APPROVED", label: "Approved", count: dayApproved },
    {
      key: "REJECTED",
      label: "Rejected",
      count: dayEntries.length - dayPending - dayApproved,
    },
  ];

  function selectDay(date: string) {
    setSelectedDate((current) => (current === date ? null : date));
    setStatusFilter("ALL");
    setSearch("");
    dispatchSelection({ type: "CLEAR" });
  }

  return (
    <div className="ot-page">
      {/* Header */}
      <div className="ot-head">
        <div>
          <div className="ot-head__eyebrow">Time &amp; Attendance</div>
          <h1 className="ot-head__title">
            <span className="ot-head__icon">
              <Clock size={18} />
            </span>
            OT Entries
          </h1>
          <div className="ot-head__sub">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </div>
        </div>

        <div className="ot-head__tools">
          <div className="ot-summary">
            <span className="ot-summary__chip">
              <strong>{weekCounts.total}</strong> this week
            </span>
            <span className="ot-summary__chip" data-tone="pending">
              <strong>{weekCounts.pending}</strong> pending
            </span>
            <span className="ot-summary__chip">
              <strong>
                {selectedDate ? formatMinutes(dayTotalMinutes) : "—"}
              </strong>
              selected day
            </span>
          </div>

          <AnimatePresence>
            {weekOffset !== 0 && (
              <motion.button
                initial={{ opacity: 0, width: 0, padding: 0 }}
                animate={{ opacity: 1, width: "auto", padding: "0 13px" }}
                exit={{ opacity: 0, width: 0, padding: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="ot-btn"
                onClick={() => setWeekOffset(0)}
                style={{ overflow: "hidden" }}
              >
                Today
              </motion.button>
            )}
          </AnimatePresence>

          <div className="ot-nav">
            <button
              className="ot-nav__btn"
              onClick={() => setWeekOffset((p) => p - 1)}
              title="Previous week"
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="ot-nav__btn"
              onClick={() => setWeekOffset((p) => p + 1)}
              title="Next week"
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {canEdit && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="ot-btn ot-btn--primary"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={15} />
              Add Entry
            </motion.button>
          )}
        </div>
      </div>

      {/* Week strip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={weekStart}
          className="ot-week"
          variants={weekGridVariants}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <div className="ot-week__grid">
            {weekDates.map((date, i) => {
              const counts = getDayCounts(date);
              const isSelected = selectedDate === date;
              const isToday = date === today;

              return (
                <motion.button
                  key={date}
                  variants={dayCardVariants}
                  className="ot-day"
                  data-selected={isSelected}
                  data-today={isToday}
                  onClick={() => selectDay(date)}
                  whileHover={{ y: -2, transition: { duration: 0.15, ease: EASE } }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="ot-day__top">
                    <span className="ot-day__label">{DAY_LABELS[i]}</span>
                    {isToday && <span className="ot-day__today">Today</span>}
                  </div>
                  <div className="ot-day__num" data-today={isToday}>
                    {date.split("-")[2]}
                  </div>

                  <div className="ot-day__counts">
                    {weekFetching ? (
                      <span className="ot-spinner" aria-label="Loading" />
                    ) : counts.total > 0 ? (
                      <>
                        {counts.pending > 0 && (
                          <span className="ot-day__pill" data-kind="PENDING">
                            {counts.pending} pending
                          </span>
                        )}
                        {counts.approved > 0 && (
                          <span className="ot-day__pill" data-kind="APPROVED">
                            {counts.approved} approved
                          </span>
                        )}
                        {counts.rejected > 0 && (
                          <span className="ot-day__pill" data-kind="REJECTED">
                            {counts.rejected} rejected
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="ot-day__empty">No entries</span>
                    )}
                  </div>

                  <div className="ot-day__hours">
                    <span>Entries</span>
                    <strong>{counts.total}</strong>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Day panel */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={selectedDate}
            className="ot-panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <div className="ot-panel__head">
              <div>
                <div className="ot-panel__title">
                  <span className="ot-panel__icon">
                    <CalendarDays size={15} />
                  </span>
                  {formatDate(selectedDate)}
                </div>
                <div className="ot-panel__sub">
                  {dayEntries.length} of {totalEmployees || 0} employees ·{" "}
                  {formatMinutes(dayTotalMinutes)} OT
                </div>
              </div>
              {canEdit && (
                <button className="ot-btn" onClick={() => setAddOpen(true)}>
                  <Plus size={13} />
                  Add for this day
                </button>
              )}
            </div>

            {isDayIncomplete && !dayLoading && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="ot-alert"
              >
                <Users size={15} />
                <span>
                  <strong>Incomplete coverage —</strong> {missingCount} of{" "}
                  {totalEmployees} employees are missing OT records for this
                  day.
                </span>
              </motion.div>
            )}

            <div className="ot-stats">
              <div className="ot-stat">
                <div className="ot-stat__label">Entries</div>
                <div className="ot-stat__value">{dayEntries.length}</div>
                <div className="ot-stat__sub">Records for this day</div>
              </div>
              <div className="ot-stat" data-tone="pending">
                <div className="ot-stat__label">Pending</div>
                <div className="ot-stat__value">{dayPending}</div>
                <div className="ot-stat__sub">Awaiting a decision</div>
              </div>
              <div className="ot-stat">
                <div className="ot-stat__label">Total OT</div>
                <div className="ot-stat__value">
                  {formatMinutes(dayTotalMinutes)}
                </div>
                <div className="ot-stat__sub">Weighted hours</div>
              </div>
              <div className="ot-stat">
                <div className="ot-stat__label">Coverage</div>
                <div className="ot-stat__value">
                  {totalEmployees > 0
                    ? `${dayEntries.length}/${totalEmployees}`
                    : "—"}
                </div>
                <div className="ot-stat__sub">Employees recorded</div>
              </div>
            </div>

            <div className="ot-toolbar">
              <div className="ot-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className="ot-tab"
                    data-active={statusFilter === tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    {tab.label}
                    <span className="ot-tab__count">{tab.count}</span>
                  </button>
                ))}
              </div>
              <label className="ot-search">
                <Search size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee or ID"
                  aria-label="Search entries"
                />
              </label>
            </div>

            <AnimatePresence>
              {showBulkToolbar && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="ot-bulk"
                >
                  <span className="ot-bulk__count">
                    {selectedCount} selected
                  </span>
                  <div className="ot-bulk__actions">
                    <button
                      className="ot-clear"
                      onClick={() => dispatchSelection({ type: "CLEAR" })}
                    >
                      Clear
                    </button>
                    <button
                      className="ot-btn"
                      onClick={() => setBulkAction("reject")}
                    >
                      <XCircle size={13} />
                      Reject {selectedCount}
                    </button>
                    <button
                      className="ot-btn"
                      onClick={() => setBulkAction("approve")}
                    >
                      <CheckCircle2 size={13} />
                      Approve {selectedCount}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {dayLoading ? (
              <div className="ot-list">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="ot-skeleton" />
                ))}
              </div>
            ) : dayEntries.length === 0 ? (
              <div className="ot-empty">
                <span className="ot-empty__icon">
                  <CalendarDays size={20} />
                </span>
                <span className="ot-empty__title">No OT entries for this day</span>
                <span className="ot-empty__sub">
                  {canEdit
                    ? "Add an entry to start reviewing overtime for this date."
                    : "Check back after submissions are recorded."}
                </span>
                {canEdit && (
                  <button
                    className="ot-btn ot-btn--primary"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus size={14} />
                    Add entry
                  </button>
                )}
              </div>
            ) : visibleEntries.length === 0 ? (
              <div className="ot-empty">
                <span className="ot-empty__icon">
                  <Search size={20} />
                </span>
                <span className="ot-empty__title">No matching entries</span>
                <span className="ot-empty__sub">
                  Try a different status or search term.
                </span>
              </div>
            ) : (
              <motion.div
                className="ot-list"
                variants={entryListVariants}
                initial="hidden"
                animate="show"
              >
                {canApprove && pendingEntries.length > 1 && (
                  <button
                    className="ot-select-all"
                    onClick={() =>
                      allPendingSelected
                        ? dispatchSelection({ type: "CLEAR" })
                        : dispatchSelection({
                            type: "SELECT_ALL",
                            ids: pendingIds,
                          })
                    }
                  >
                    {allPendingSelected ? (
                      <CheckSquare size={14} color="var(--brand-500)" />
                    ) : (
                      <Square size={14} />
                    )}
                    {allPendingSelected
                      ? "Deselect all pending"
                      : "Select all pending"}
                  </button>
                )}

                {visibleEntries.map((entry) => {
                  const isPending = entry.status === "PENDING";
                  const isSelected = selectedIds.has(entry.id);

                  return (
                    <motion.div
                      key={entry.id}
                      layout
                      className="ot-entry"
                      data-selected={isSelected}
                      variants={entryRowVariants}
                      exit={{
                        opacity: 0,
                        x: -6,
                        transition: { duration: 0.15 },
                      }}
                    >
                      {canApprove && isPending && (
                        <button
                          className="ot-entry__check"
                          data-checked={isSelected}
                          onClick={() =>
                            dispatchSelection({ type: "TOGGLE", id: entry.id })
                          }
                          aria-label={
                            isSelected ? "Deselect entry" : "Select entry"
                          }
                        >
                          {isSelected ? (
                            <CheckSquare size={16} />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      )}

                      <span className="ot-entry__avatar">
                        {entry.employee.empId}
                      </span>

                      <div className="ot-entry__main">
                        <div className="ot-entry__name-row">
                          <span className="ot-entry__name">
                            {entry.employee.name}
                          </span>
                          <StatusBadge status={entry.status} />
                        </div>
                        <div className="ot-entry__meta">
                          <span>{entry.shift}</span>
                          {entry.inTime && (
                            <>
                              <span>·</span>
                              <Clock size={11} />
                              <span>
                                {entry.inTime} – {entry.outTime}
                              </span>
                            </>
                          )}
                          {entry.isNight && (
                            <span className="ot-entry__flag" title="Night shift">
                              <Moon size={11} /> night
                            </span>
                          )}
                          {entry.manualOverride && (
                            <span
                              className="ot-entry__flag"
                              title="Manually overridden"
                            >
                              <AlertTriangle size={11} /> manual
                            </span>
                          )}
                          {entry.reason && (
                            <span
                              title={entry.reason}
                              style={{
                                maxWidth: 180,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              · {entry.reason}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="ot-entry__breakdown">
                        {[
                          {
                            label: "Normal",
                            kind: "normal",
                            value: entry.normalMinutes,
                          },
                          {
                            label: "Double",
                            kind: "double",
                            value: entry.doubleMinutes,
                          },
                          {
                            label: "Triple",
                            kind: "triple",
                            value: entry.tripleMinutes,
                          },
                        ].map(({ label, kind, value }) =>
                          value > 0 ? (
                            <span
                              key={kind}
                              className="ot-chip"
                              data-kind={kind}
                            >
                              <span className="ot-chip__label">{label}</span>
                              <span className="ot-chip__value">
                                {formatMinutes(value)}
                              </span>
                            </span>
                          ) : null,
                        )}
                      </div>

                      <div className="ot-entry__total">
                        <span className="ot-entry__total-label">Total</span>
                        <span className="ot-entry__total-value">
                          {formatMinutes(entryTotalMinutes(entry))}
                        </span>
                      </div>

                      <div className="ot-entry__actions">
                        {canApprove && isPending && (
                          <>
                            <ActionBtn
                              icon={CheckCircle2}
                              label="Approve"
                              tone="approve"
                              onClick={() => setApproveEntry(entry)}
                            />
                            <ActionBtn
                              icon={XCircle}
                              label="Reject"
                              tone="reject"
                              onClick={() => setRejectEntry(entry)}
                            />
                          </>
                        )}
                        {canEdit && (
                          <>
                            <ActionBtn
                              icon={Pencil}
                              label="Edit"
                              tone="edit"
                              onClick={() => setEditEntry(entry)}
                            />
                            <ActionBtn
                              icon={Trash2}
                              label="Delete"
                              tone="delete"
                              onClick={() => handleDelete(entry.id)}
                            />
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AddEntryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={refresh}
        defaultDate={selectedDate ?? undefined}
        closeOnBackdropClick={false}
      />
      <ApproveModal
        open={!!approveEntry}
        onClose={() => setApproveEntry(null)}
        onSuccess={refresh}
        entry={approveEntry}
      />
      <RejectModal
        open={!!rejectEntry}
        onClose={() => setRejectEntry(null)}
        onSuccess={refresh}
        entry={rejectEntry}
      />
      <EditEntryModal
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        onSuccess={refresh}
        entry={editEntry}
      />
      <BulkApproveModal
        open={!!bulkAction}
        onClose={() => setBulkAction(null)}
        onSuccess={handleBulkSuccess}
        selectedIds={[...selectedIds]}
        action={bulkAction ?? "approve"}
      />
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone: "approve" | "reject" | "edit" | "delete";
  onClick: () => void;
}) {
  return (
    <button
      className="ot-action"
      data-tone={tone}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon size={14} strokeWidth={2} />
      <span className="ot-action__label">{label}</span>
    </button>
  );
}
