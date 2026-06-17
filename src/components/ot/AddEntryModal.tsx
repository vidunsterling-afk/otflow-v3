"use client";

import {
  useReducer,
  useEffect,
  useRef,
  useCallback,
  memo,
  useTransition,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { toast } from "sonner";
import {
  Loader2,
  Zap,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatMinutes } from "@/lib/utils";
import { calcOtMinutes } from "@/lib/otCalc";

const SHIFTS = ["Shift 1", "Shift 2", "NO_SHIFT"];

// ─── Types ────────────────────────────────────────────────────────

interface Employee {
  id: string;
  empId: string;
  name: string;
}

interface EntryRow {
  localId: string;
  // per-row employee
  employeeQuery: string;
  employeeResults: Employee[];
  showDropdown: boolean;
  selectedEmployee: Employee | null;
  // entry fields
  shift: string;
  inTime: string;
  outTime: string;
  reason: string;
  manualOverride: boolean;
  manualNormal: number;
  manualDouble: number;
  manualTriple: number;
  expanded: boolean;
}

type Action =
  | { type: "ADD_ROW" }
  | { type: "REMOVE_ROW"; localId: string }
  | { type: "TOGGLE_ROW"; localId: string }
  | { type: "UPDATE_ROW"; localId: string; patch: Partial<EntryRow> }
  | { type: "SET_DATE"; value: string }
  | { type: "RESET"; defaultDate?: string };

interface State {
  workDate: string;
  rows: EntryRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────

function makeRow(): EntryRow {
  return {
    localId: crypto.randomUUID(),
    employeeQuery: "",
    employeeResults: [],
    showDropdown: false,
    selectedEmployee: null,
    shift: "Shift 1",
    inTime: "",
    outTime: "",
    reason: "",
    manualOverride: false,
    manualNormal: 0,
    manualDouble: 0,
    manualTriple: 0,
    expanded: true,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_ROW":
      return { ...state, rows: [...state.rows, makeRow()] };
    case "REMOVE_ROW":
      return {
        ...state,
        rows: state.rows.filter((r) => r.localId !== action.localId),
      };
    case "TOGGLE_ROW":
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.localId === action.localId ? { ...r, expanded: !r.expanded } : r,
        ),
      };
    case "UPDATE_ROW":
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.localId === action.localId ? { ...r, ...action.patch } : r,
        ),
      };
    case "SET_DATE":
      return { ...state, workDate: action.value };
    case "RESET":
      return { workDate: action.defaultDate ?? "", rows: [makeRow()] };
    default:
      return state;
  }
}

// ─── Row component (memoised) ─────────────────────────────────────

interface RowProps {
  row: EntryRow;
  index: number;
  canRemove: boolean;
  workDate: string;
  onUpdate: (localId: string, patch: Partial<EntryRow>) => void;
  onRemove: (localId: string) => void;
  onToggle: (localId: string) => void;
}

const EntryRowCard = memo(function EntryRowCard({
  row,
  index,
  canRemove,
  workDate,
  onUpdate,
  onRemove,
  onToggle,
}: RowProps) {
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNoShift = row.shift === "NO_SHIFT";

  const u = useCallback(
    (patch: Partial<EntryRow>) => onUpdate(row.localId, patch),
    [onUpdate, row.localId],
  );

  // Debounced employee search — scoped per row
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (row.employeeQuery.length < 1) {
      u({ employeeResults: [] });
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(
        `/api/employees/search?q=${encodeURIComponent(row.employeeQuery)}`,
      );
      const data = await res.json();
      u({ employeeResults: data, showDropdown: true });
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.employeeQuery]);

  const preview =
    !row.manualOverride && !isNoShift && row.inTime && row.outTime && workDate
      ? calcOtMinutes({
          workDate,
          shift: row.shift,
          inTime: row.inTime,
          outTime: row.outTime,
          isTripleDay: false,
        })
      : null;

  return (
    <div
      style={{
        border: "1px solid var(--border-base)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 12px",
          background: "var(--bg-muted)",
          borderBottom: row.expanded ? "1px solid var(--border-base)" : "none",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => onToggle(row.localId)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--brand-500)",
              color: "white",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {index + 1}
          </div>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: row.selectedEmployee
                ? "var(--text-primary)"
                : "var(--text-muted)",
            }}
          >
            {row.selectedEmployee
              ? `${row.selectedEmployee.name} · ${row.shift}`
              : "Select employee…"}
          </span>
          {preview && (
            <span
              style={{
                fontSize: 11,
                color: "var(--brand-600)",
                background: "var(--brand-50)",
                border: "1px solid var(--brand-100)",
                borderRadius: 99,
                padding: "1px 7px",
              }}
            >
              {formatMinutes(
                preview.normalMinutes +
                  preview.doubleMinutes +
                  preview.tripleMinutes,
              )}{" "}
              OT
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {canRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(row.localId);
              }}
              title="Remove row"
              style={{
                width: 24,
                height: 24,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--status-rejected-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
          {row.expanded ? (
            <ChevronUp size={13} color="var(--text-muted)" />
          ) : (
            <ChevronDown size={13} color="var(--text-muted)" />
          )}
        </div>
      </div>

      {/* Row body */}
      <AnimatePresence initial={false}>
        {row.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* Employee search */}
              <FormField label="Employee" required>
                <div style={{ position: "relative" }}>
                  {row.selectedEmployee ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 11px",
                        border: "1px solid var(--border-base)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-muted)",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: "var(--text-primary)",
                          }}
                        >
                          {row.selectedEmployee.name}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginLeft: 6,
                          }}
                        >
                          #{row.selectedEmployee.empId}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          u({
                            selectedEmployee: null,
                            employeeQuery: "",
                            employeeResults: [],
                          })
                        }
                        style={{
                          fontSize: 11,
                          color: "var(--brand-500)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder="Search by name or ID…"
                        value={row.employeeQuery}
                        onChange={(e) => u({ employeeQuery: e.target.value })}
                        onFocus={() =>
                          row.employeeResults.length > 0 &&
                          u({ showDropdown: true })
                        }
                        onBlur={() =>
                          setTimeout(() => u({ showDropdown: false }), 150)
                        }
                      />
                      <AnimatePresence>
                        {row.showDropdown && row.employeeResults.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            style={{
                              position: "absolute",
                              top: "calc(100% + 4px)",
                              left: 0,
                              right: 0,
                              background: "var(--bg-card)",
                              border: "1px solid var(--border-base)",
                              borderRadius: "var(--radius-md)",
                              boxShadow: "var(--shadow-dropdown)",
                              zIndex: 200,
                              overflow: "hidden",
                              maxHeight: 180,
                              overflowY: "auto",
                            }}
                          >
                            {row.employeeResults.map((emp) => (
                              <button
                                key={emp.id}
                                onClick={() =>
                                  u({
                                    selectedEmployee: emp,
                                    showDropdown: false,
                                    employeeQuery: "",
                                    employeeResults: [],
                                  })
                                }
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "9px 12px",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                                onMouseEnter={(e) =>
                                  ((
                                    e.currentTarget as HTMLElement
                                  ).style.background = "var(--bg-muted)")
                                }
                                onMouseLeave={(e) =>
                                  ((
                                    e.currentTarget as HTMLElement
                                  ).style.background = "none")
                                }
                              >
                                <div
                                  style={{
                                    width: 26,
                                    height: 26,
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
                                  {emp.empId}
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    {emp.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    #{emp.empId}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              </FormField>

              {/* Shift */}
              <FormField label="Shift" required>
                <Select
                  value={row.shift}
                  onChange={(e) => u({ shift: e.target.value })}
                >
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormField>

              {/* In/Out times */}
              {!isNoShift && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <FormField label="In Time" required>
                    <Input
                      type="time"
                      value={row.inTime}
                      onChange={(e) => u({ inTime: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Out Time" required>
                    <Input
                      type="time"
                      value={row.outTime}
                      onChange={(e) => u({ outTime: e.target.value })}
                    />
                  </FormField>
                </div>
              )}

              {/* OT preview */}
              <AnimatePresence>
                {preview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      padding: "8px 11px",
                      background: "var(--brand-50)",
                      border: "1px solid var(--brand-100)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <Zap size={12} color="var(--brand-500)" />
                    <div style={{ fontSize: 12, color: "var(--brand-700)" }}>
                      <strong>Calculated:</strong> Normal{" "}
                      {formatMinutes(preview.normalMinutes)} · Double{" "}
                      {formatMinutes(preview.doubleMinutes)} · Triple{" "}
                      {formatMinutes(preview.tripleMinutes)}
                      {preview.isNight && " · 🌙 Night"}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Manual override toggle */}
              <div
                onClick={() => u({ manualOverride: !row.manualOverride })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 11px",
                  background: row.manualOverride
                    ? "var(--status-pending-bg)"
                    : "var(--bg-muted)",
                  border: `1px solid ${row.manualOverride ? "var(--status-pending-border)" : "var(--border-base)"}`,
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <AlertTriangle
                    size={12}
                    color={
                      row.manualOverride
                        ? "var(--status-pending-text)"
                        : "var(--text-muted)"
                    }
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: row.manualOverride
                        ? "var(--status-pending-text)"
                        : "var(--text-secondary)",
                    }}
                  >
                    Manual Override
                  </span>
                </div>
                <div
                  style={{
                    width: 32,
                    height: 18,
                    borderRadius: 99,
                    background: row.manualOverride
                      ? "var(--status-pending-text)"
                      : "var(--border-strong)",
                    position: "relative",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <motion.div
                    animate={{ left: row.manualOverride ? 16 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    style={{
                      position: "absolute",
                      top: 2,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "white",
                    }}
                  />
                </div>
              </div>

              {/* Manual inputs */}
              <AnimatePresence>
                {row.manualOverride && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <FormField label="Normal (min)">
                        <Input
                          type="number"
                          min={0}
                          step={15}
                          value={row.manualNormal}
                          onChange={(e) =>
                            u({ manualNormal: Number(e.target.value) })
                          }
                        />
                      </FormField>
                      <FormField label="Double (min)">
                        <Input
                          type="number"
                          min={0}
                          step={15}
                          value={row.manualDouble}
                          onChange={(e) =>
                            u({ manualDouble: Number(e.target.value) })
                          }
                        />
                      </FormField>
                      <FormField label="Triple (min)">
                        <Input
                          type="number"
                          min={0}
                          step={15}
                          value={row.manualTriple}
                          onChange={(e) =>
                            u({ manualTriple: Number(e.target.value) })
                          }
                        />
                      </FormField>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reason */}
              <FormField label="Reason / Notes">
                <Textarea
                  placeholder="Optional reason for OT…"
                  value={row.reason}
                  onChange={(e) => u({ reason: e.target.value })}
                />
              </FormField>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Main Modal ───────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
}

export function AddEntryModal({
  open,
  onClose,
  onSuccess,
  defaultDate,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    workDate: defaultDate ?? "",
    rows: [makeRow()],
  });
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useSimpleState(false);

  useEffect(() => {
    if (open) dispatch({ type: "RESET", defaultDate });
  }, [open, defaultDate]);

  const handleUpdate = useCallback(
    (localId: string, patch: Partial<EntryRow>) =>
      dispatch({ type: "UPDATE_ROW", localId, patch }),
    [],
  );
  const handleRemove = useCallback(
    (localId: string) => dispatch({ type: "REMOVE_ROW", localId }),
    [],
  );
  const handleToggle = useCallback(
    (localId: string) => dispatch({ type: "TOGGLE_ROW", localId }),
    [],
  );

  function handleAddRow() {
    startTransition(() => dispatch({ type: "ADD_ROW" }));
  }

  async function handleSubmit() {
    if (!state.workDate) {
      toast.error("Select a work date");
      return;
    }

    // Validate all rows
    for (let i = 0; i < state.rows.length; i++) {
      const row = state.rows[i];
      if (!row.selectedEmployee) {
        toast.error(`Row ${i + 1}: Select an employee`);
        if (!row.expanded)
          dispatch({ type: "TOGGLE_ROW", localId: row.localId });
        return;
      }
      if (row.shift !== "NO_SHIFT" && (!row.inTime || !row.outTime)) {
        toast.error(`Row ${i + 1}: Enter in/out times`);
        if (!row.expanded)
          dispatch({ type: "TOGGLE_ROW", localId: row.localId });
        return;
      }
    }

    setLoading(true);
    try {
      const entries = state.rows.map((row) => ({
        employeeId: row.selectedEmployee!.id,
        workDate: state.workDate,
        shift: row.shift,
        inTime: row.shift === "NO_SHIFT" ? null : row.inTime,
        outTime: row.shift === "NO_SHIFT" ? null : row.outTime,
        reason: row.reason,
        manualOverride: row.manualOverride,
        normalMinutes: row.manualNormal,
        doubleMinutes: row.manualDouble,
        tripleMinutes: row.manualTriple,
      }));

      const payload = entries.length === 1 ? entries[0] : entries;

      const res = await fetch("/api/ot-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }

      const result = await res.json();

      if (Array.isArray(result?.succeeded)) {
        const { succeeded, failed } = result as {
          succeeded: unknown[];
          failed: { index: number; error: string }[];
        };
        if (succeeded.length > 0)
          toast.success(
            `${succeeded.length} entr${succeeded.length === 1 ? "y" : "ies"} added`,
          );
        if (failed.length > 0) {
          // Show a specific toast per failed row with the server's error message
          failed.forEach((f) => {
            const row = state.rows[f.index];
            const label = row?.selectedEmployee
              ? row.selectedEmployee.name
              : `Row ${f.index + 1}`;
            toast.error(`${label}: ${f.error}`);
          });

          // Keep only failed rows open so user can fix and retry
          const failedLocalIds = new Set(
            failed.map((f) => state.rows[f.index]?.localId),
          );
          state.rows.forEach((row) => {
            if (!failedLocalIds.has(row.localId))
              dispatch({ type: "REMOVE_ROW", localId: row.localId });
          });

          if (succeeded.length > 0)
            toast.success(
              `${succeeded.length} entr${succeeded.length === 1 ? "y" : "ies"} added successfully`,
            );

          onSuccess();
          return;
        }
      } else {
        toast.success("OT entry added");
      }

      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add OT Entries${state.rows.length > 1 ? ` (${state.rows.length})` : ""}`}
      width={580}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Work date — shared across all rows */}
        <FormField label="Work Date" required>
          <Input
            type="date"
            value={state.workDate}
            onChange={(e) =>
              dispatch({ type: "SET_DATE", value: e.target.value })
            }
          />
        </FormField>

        <div style={{ borderTop: "1px solid var(--border-base)" }} />

        {/* Entry rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {state.rows.map((row, i) => (
            <EntryRowCard
              key={row.localId}
              row={row}
              index={i}
              canRemove={state.rows.length > 1}
              workDate={state.workDate}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {/* Add row button */}
        <button
          onClick={handleAddRow}
          disabled={isPending}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 0",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "transparent",
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--brand-600)",
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
            touchAction: "manipulation",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "var(--brand-50)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--brand-300)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--border-strong)";
          }}
        >
          <Plus size={13} />
          Add another employee entry
        </button>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            paddingTop: 4,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-base)",
              background: "transparent",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: "8px 18px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: loading ? "var(--brand-300)" : "var(--brand-500)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              touchAction: "manipulation",
            }}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {state.rows.length > 1
              ? `Submit ${state.rows.length} Entries`
              : "Add Entry"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Tiny helper (avoids useState import just for one boolean) ────

function useSimpleState<T>(initial: T): [T, (v: T) => void] {
  const [s, d] = useReducer((_: T, v: T) => v, initial);
  return [s, d];
}
