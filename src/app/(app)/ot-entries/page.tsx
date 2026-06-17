"use client";

import { useState, useCallback, useReducer } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, number } from "framer-motion";
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
} from "lucide-react";
import {
  getWeekDates,
  formatDate,
  formatMinutes,
  getDayOfWeek,
} from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AddEntryModal } from "@/components/ot/AddEntryModal";
import {
  ApproveModal,
  RejectModal,
  EditEntryModal,
  BulkApproveModal,
} from "@/components/ot/EntryActionModals";
import { RefreshCcw } from "@deemlol/next-icons";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

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
  status: string;
  manualOverride: boolean;
  approvedTotalMinutes: number;
  employee: { name: string; empId: string };
}

interface DaySummary {
  workDate: string;
  status: string;
  _count: { _all: number };
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export default function OtEntriesPage() {
  const { data: session } = useSession();
  const permissions = (session?.user as any)?.permissions ?? [];
  const canApprove = permissions.includes("ot:approve");
  const canEdit = permissions.includes("ot:edit");

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [approveEntry, setApproveEntry] = useState<OtEntry | null>(null);
  const [rejectEntry, setRejectEntry] = useState<OtEntry | null>(null);
  const [editEntry, setEditEntry] = useState<OtEntry | null>(null);

  // Bulk action state
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
    staleTime: 5 * 60 * 1000, // 5 min
  });
  const totalEmployees = empCountData?.count ?? 0;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["ot-week", weekStart] });
    queryClient.invalidateQueries({ queryKey: ["ot-day", selectedDate] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }, [queryClient, weekStart, selectedDate]);

  function getDayCounts(date: string) {
    const rows = weekSummary.filter((r) => r.workDate === date);
    const pending = rows.find((r) => r.status === "PENDING")?._count._all ?? 0;
    const approved =
      rows.find((r) => r.status === "APPROVED")?._count._all ?? 0;
    const rejected =
      rows.find((r) => r.status === "REJECTED")?._count._all ?? 0;
    return {
      pending,
      approved,
      rejected,
      total: pending + approved + rejected,
    };
  }

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

  // Bulk approve success: optimistically remove approved IDs from selection
  // and invalidate queries so the list refreshes
  function handleBulkSuccess(succeededIds: string[]) {
    dispatchSelection({ type: "REMOVE_IDS", ids: succeededIds });
    refresh();
  }

  // Pending entries visible in current day view — only these can be bulk-actioned
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

  const today = new Date().toISOString().split("T")[0];

  return (
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
            OT Entries
          </div>
          <div
            style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}
          >
            {weekStart} → {weekEnd}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              style={{
                padding: "0 12px",
                height: 34,
                border: "1px solid var(--border-base)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-card)",
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Today
            </button>
          )}
          {/* Week nav */}
          <div
            style={{
              display: "flex",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            {[
              { icon: ChevronLeft, action: () => setWeekOffset((p) => p - 1) },
              { icon: ChevronRight, action: () => setWeekOffset((p) => p + 1) },
            ].map(({ icon: Icon, action }, i) => (
              <button
                key={i}
                onClick={action}
                style={{
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  background: "var(--bg-card)",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  borderRight:
                    i === 0 ? "1px solid var(--border-base)" : "none",
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
                <Icon size={15} />
              </button>
            ))}
          </div>
          {canEdit && (
            <button
              onClick={() => setAddOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 14px",
                height: 34,
                border: "none",
                borderRadius: "var(--radius-md)",
                background: "var(--brand-500)",
                color: "white",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              <Plus size={14} />
              Add Entry
            </button>
          )}
        </div>
      </div>

      {/* Week day cards */}
      <AnimatePresence mode="wait">
        <motion.div
          key={weekStart}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 10,
          }}
        >
          {weekDates.map((date, i) => {
            const counts = getDayCounts(date);
            const isSelected = selectedDate === date;
            const isToday = date === today;

            return (
              <motion.button
                key={date}
                initial={{
                  opacity: 0,
                  y: 8,
                  scale: 0.98,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                transition={{
                  duration: 0.2,
                  delay: i * 0.03,
                  ease: "easeOut",
                }}
                onClick={() => {
                  setSelectedDate(isSelected ? null : date);
                  dispatchSelection({ type: "CLEAR" });
                }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  border: `1px solid ${
                    isSelected ? "var(--brand-300)" : "var(--border-base)"
                  }`,
                  borderRadius: "var(--radius-lg)",
                  padding: "14px 10px",
                  background: isSelected ? "var(--brand-50)" : "var(--bg-card)",
                  cursor: "pointer",
                  textAlign: "center",
                  boxShadow: isSelected
                    ? "0 0 0 2px var(--brand-200)"
                    : "var(--shadow-card)",
                  transition:
                    "border-color 0.15s, background 0.15s, box-shadow 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    color: isSelected
                      ? "var(--brand-500)"
                      : "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  {DAY_LABELS[i]}
                </div>

                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.5px",
                    color: isToday ? "var(--brand-500)" : "var(--text-primary)",
                    marginBottom: 2,
                  }}
                >
                  {date.split("-")[2]}
                </div>

                {isToday && (
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--brand-500)",
                      margin: "0 auto 6px",
                    }}
                  />
                )}

                <AnimatePresence mode="wait">
                  {weekFetching ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <RefreshCcw size={14} strokeWidth={2.5} />
                      </motion.div>
                    </motion.div>
                  ) : counts.total > 0 ? (
                    <motion.div
                      key="counts"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{
                        duration: 0.22,
                        ease: "easeOut",
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        marginTop: 6,
                      }}
                    >
                      {counts.pending > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.03 }}
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "var(--status-pending-text)",
                            background: "var(--status-pending-bg)",
                            borderRadius: 99,
                            padding: "1px 6px",
                          }}
                        >
                          {counts.pending} pending
                        </motion.div>
                      )}

                      {counts.approved > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.06 }}
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "var(--status-approved-text)",
                            background: "var(--status-approved-bg)",
                            borderRadius: 99,
                            padding: "1px 6px",
                          }}
                        >
                          {counts.approved} approved
                        </motion.div>
                      )}

                      {counts.rejected > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.09 }}
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "var(--status-rejected-text)",
                            background: "var(--status-rejected-bg)",
                            borderRadius: 99,
                            padding: "1px 6px",
                          }}
                        >
                          {counts.rejected} rejected
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 6,
                      }}
                    >
                      No entries
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Day entries panel */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              padding: 20,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <SectionHeader
              title={`${getDayOfWeek(selectedDate)}, ${formatDate(selectedDate)}`}
              sub={`${dayEntries.length} of ${totalEmployees} employees`}
              icon={CalendarDays}
              action={
                canEdit ? (
                  <button
                    onClick={() => setAddOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-base)",
                      background: "transparent",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={12} /> Add for this day
                  </button>
                ) : undefined
              }
            />

            {/* ── Incomplete coverage badge ── */}
            <AnimatePresence>
              {isDayIncomplete && !dayLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden", marginBottom: 14 }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 14px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--status-pending-bg)",
                      border:
                        "1px solid var(--status-pending-border, #f59e0b40)",
                    }}
                  >
                    <Users
                      size={14}
                      color="var(--status-pending-text)"
                      strokeWidth={2.5}
                    />
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--status-pending-text)",
                      }}
                    >
                      Incomplete —
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--status-pending-text)",
                      }}
                    >
                      {missingCount} of {totalEmployees} employees missing OT
                      records
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bulk action toolbar — slides in when entries are selected */}
            <AnimatePresence>
              {showBulkToolbar && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      background: "var(--brand-50)",
                      border: "1px solid var(--brand-200)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--brand-700)",
                      }}
                    >
                      {selectedCount} selected
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <button
                        onClick={() => dispatchSelection({ type: "CLEAR" })}
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-muted)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 500,
                          padding: "4px 8px",
                          touchAction: "manipulation",
                        }}
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setBulkAction("reject")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 12px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--status-rejected-border)",
                          background: "var(--status-rejected-bg)",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--status-rejected-text)",
                          cursor: "pointer",
                          touchAction: "manipulation",
                        }}
                      >
                        <XCircle size={12} />
                        Reject {selectedCount}
                      </button>
                      <button
                        onClick={() => setBulkAction("approve")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 12px",
                          borderRadius: "var(--radius-sm)",
                          border: "none",
                          background: "var(--status-approved-text)",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "white",
                          cursor: "pointer",
                          touchAction: "manipulation",
                        }}
                      >
                        <CheckCircle2 size={12} />
                        Approve {selectedCount}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {dayLoading && (
              <div
                style={{
                  padding: "32px 0",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                Loading...
              </div>
            )}

            {!dayLoading && dayEntries.length === 0 && (
              <div
                style={{
                  padding: "32px 0",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No OT entries for this day
              </div>
            )}

            {!dayLoading && dayEntries.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Select-all row — only shown when there are pending entries and user can approve */}
                {canApprove && pendingEntries.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 2px",
                    }}
                  >
                    <button
                      onClick={() =>
                        allPendingSelected
                          ? dispatchSelection({ type: "CLEAR" })
                          : dispatchSelection({
                              type: "SELECT_ALL",
                              ids: pendingIds,
                            })
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                        padding: "4px 0",
                        touchAction: "manipulation",
                      }}
                    >
                      {allPendingSelected ? (
                        <CheckSquare size={13} color="var(--brand-500)" />
                      ) : (
                        <Square size={13} />
                      )}
                      {allPendingSelected
                        ? "Deselect all"
                        : "Select all pending"}
                    </button>
                  </div>
                )}

                {dayEntries.map((entry, i) => {
                  const isPending = entry.status === "PENDING";
                  const isSelected = selectedIds.has(entry.id);

                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        border: `1px solid ${isSelected ? "var(--brand-300)" : "var(--border-base)"}`,
                        borderRadius: "var(--radius-md)",
                        background: isSelected
                          ? "var(--brand-50)"
                          : "var(--bg-base)",
                        gap: 12,
                        transition: "border-color 0.1s, background 0.1s",
                      }}
                    >
                      {/* Checkbox — only for pending + approver */}
                      {canApprove && isPending && (
                        <button
                          onClick={() =>
                            dispatchSelection({ type: "TOGGLE", id: entry.id })
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            flexShrink: 0,
                            color: isSelected
                              ? "var(--brand-500)"
                              : "var(--text-muted)",
                            touchAction: "manipulation",
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare size={15} />
                          ) : (
                            <Square size={15} />
                          )}
                        </button>
                      )}

                      {/* Left — employee info */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "var(--radius-sm)",
                            background: "var(--brand-50)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--brand-600)",
                            flexShrink: 0,
                          }}
                        >
                          {entry.employee.empId}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            {entry.employee.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>{entry.shift}</span>
                            {entry.inTime && (
                              <>
                                · <Clock size={10} /> {entry.inTime} –{" "}
                                {entry.outTime}
                              </>
                            )}
                            {entry.isNight && (
                              <Moon size={10} color="var(--brand-400)" />
                            )}
                            {entry.manualOverride && (
                              <span
                                style={{
                                  color: "var(--status-pending-text)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                }}
                              >
                                <AlertTriangle size={10} /> manual
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle — OT breakdown */}
                      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                        {[
                          { label: "Normal", value: entry.normalMinutes },
                          { label: "Double", value: entry.doubleMinutes },
                          { label: "Triple", value: entry.tripleMinutes },
                        ].map(({ label, value }) =>
                          value > 0 ? (
                            <div key={label} style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.4px",
                                }}
                              >
                                {label}
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "var(--text-primary)",
                                }}
                              >
                                {formatMinutes(value)}
                              </div>
                            </div>
                          ) : null,
                        )}
                      </div>

                      {/* Right — status + actions */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexShrink: 0,
                        }}
                      >
                        <StatusBadge status={entry.status} />
                        <div style={{ display: "flex", gap: 4 }}>
                          {canApprove && entry.status === "PENDING" && (
                            <>
                              <ActionBtn
                                icon={CheckCircle2}
                                color="var(--status-approved-text)"
                                bg="var(--status-approved-bg)"
                                title="Approve"
                                onClick={() => setApproveEntry(entry)}
                              />
                              <ActionBtn
                                icon={XCircle}
                                color="var(--status-rejected-text)"
                                bg="var(--status-rejected-bg)"
                                title="Reject"
                                onClick={() => setRejectEntry(entry)}
                              />
                            </>
                          )}
                          {canEdit && (
                            <>
                              <ActionBtn
                                icon={Pencil}
                                color="var(--brand-600)"
                                bg="var(--brand-50)"
                                title="Edit"
                                onClick={() => setEditEntry(entry)}
                              />
                              <ActionBtn
                                icon={Trash2}
                                color="var(--status-rejected-text)"
                                bg="var(--status-rejected-bg)"
                                title="Delete"
                                onClick={() => handleDelete(entry.id)}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
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
  color,
  bg,
  title,
  onClick,
}: {
  icon: any;
  color: string;
  bg: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: "var(--radius-sm)",
        border: "1px solid transparent",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color,
        transition: "background 0.12s, border-color 0.12s",
        touchAction: "manipulation",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = bg;
        (e.currentTarget as HTMLElement).style.borderColor = color + "40";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.borderColor = "transparent";
      }}
    >
      <Icon size={13} strokeWidth={2} />
    </button>
  );
}
