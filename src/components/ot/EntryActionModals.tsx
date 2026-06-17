"use client";

import { useState, useEffect, useReducer } from "react";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { formatMinutes } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { calcOtMinutes } from "@/lib/otCalc";

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
  employee: { name: string; empId: string };
}

interface DecisionReason {
  id: string;
  type: string;
  label: string;
}

// ─── Approve Modal ────────────────────────────────────────────────
export function ApproveModal({
  open,
  onClose,
  onSuccess,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: OtEntry | null;
}) {
  const [decisionReason, setDecisionReason] = useState("");
  const [override, setOverride] = useState(false);
  const [approvedNormal, setApprovedNormal] = useState(0);
  const [approvedDouble, setApprovedDouble] = useState(0);
  const [approvedTriple, setApprovedTriple] = useState(0);
  const [loading, setLoading] = useState(false);

  const { data: reasons = [] } = useQuery<DecisionReason[]>({
    queryKey: ["decision-reasons"],
    queryFn: () => fetch("/api/decision-reasons").then((r) => r.json()),
  });

  useEffect(() => {
    if (entry) {
      setApprovedNormal(entry.normalMinutes);
      setApprovedDouble(entry.doubleMinutes);
      setApprovedTriple(entry.tripleMinutes);
      setOverride(false);
      setDecisionReason("");
    }
  }, [entry]);

  if (!entry) return null;

  const approveReasons = reasons.filter((r) => r.type === "APPROVE");
  const total =
    (override ? approvedNormal : entry.normalMinutes) +
    (override ? approvedDouble : entry.doubleMinutes) * 2 +
    (override ? approvedTriple : entry.tripleMinutes) * 3;

  async function handleApprove() {
    if (!entry) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ot-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          decisionReason,
          isApprovedOverride: override,
          approvedNormalMinutes: approvedNormal,
          approvedDoubleMinutes: approvedDouble,
          approvedTripleMinutes: approvedTriple,
        }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast.success("Entry approved");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to approve entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Approve OT Entry"
      subtitle={`${entry.employee.name} · ${entry.workDate}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Summary */}
        <div
          style={{
            padding: "12px 14px",
            background: "var(--status-approved-bg)",
            border: "1px solid var(--status-approved-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--status-approved-text)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Calculated OT
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "Normal", value: entry.normalMinutes },
              { label: "Double", value: entry.doubleMinutes },
              { label: "Triple", value: entry.tripleMinutes },
            ].map(({ label, value }) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {formatMinutes(value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Override toggle */}
        <div
          onClick={() => setOverride((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 12px",
            background: override
              ? "var(--status-pending-bg)"
              : "var(--bg-muted)",
            border: `1px solid ${override ? "var(--status-pending-border)" : "var(--border-base)"}`,
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <AlertTriangle
              size={12}
              color={
                override ? "var(--status-pending-text)" : "var(--text-muted)"
              }
            />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: override
                  ? "var(--status-pending-text)"
                  : "var(--text-secondary)",
              }}
            >
              Override approved minutes
            </span>
          </div>
          <div
            style={{
              width: 32,
              height: 18,
              borderRadius: 99,
              background: override
                ? "var(--status-pending-text)"
                : "var(--border-strong)",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <motion.div
              animate={{ left: override ? 16 : 2 }}
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

        <AnimatePresence>
          {override && (
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
                  gap: 10,
                }}
              >
                <FormField label="Normal (min)">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={approvedNormal}
                    onChange={(e) => setApprovedNormal(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Double (min)">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={approvedDouble}
                    onChange={(e) => setApprovedDouble(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Triple (min)">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={approvedTriple}
                    onChange={(e) => setApprovedTriple(Number(e.target.value))}
                  />
                </FormField>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          style={{
            padding: "8px 12px",
            background: "var(--bg-muted)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12.5,
            color: "var(--text-secondary)",
          }}
        >
          Effective total:{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {formatMinutes(total)}
          </strong>
        </div>

        <FormField label="Approval Reason">
          <Select
            value={decisionReason}
            onChange={(e) => setDecisionReason(e.target.value)}
          >
            <option value="">Select reason (optional)...</option>
            {approveReasons.map((r) => (
              <option key={r.id} value={r.label}>
                {r.label}
              </option>
            ))}
          </Select>
        </FormField>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            style={{
              padding: "8px 18px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--status-approved-text)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            Approve
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────
export function RejectModal({
  open,
  onClose,
  onSuccess,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: OtEntry | null;
}) {
  const [decisionReason, setDecisionReason] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: reasons = [] } = useQuery<DecisionReason[]>({
    queryKey: ["decision-reasons"],
    queryFn: () => fetch("/api/decision-reasons").then((r) => r.json()),
  });

  if (!entry) return null;
  const rejectReasons = reasons.filter((r) => r.type === "REJECT");

  async function handleReject() {
    if (!entry) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ot-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", decisionReason }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Entry rejected");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to reject entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject OT Entry"
      subtitle={`${entry.employee.name} · ${entry.workDate}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            padding: "12px 14px",
            background: "var(--status-rejected-bg)",
            border: "1px solid var(--status-rejected-border)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "var(--status-rejected-text)",
          }}
        >
          This entry will be marked as rejected and the employee notified.
        </div>
        <FormField label="Rejection Reason">
          <Select
            value={decisionReason}
            onChange={(e) => setDecisionReason(e.target.value)}
          >
            <option value="">Select reason (optional)...</option>
            {rejectReasons.map((r) => (
              <option key={r.id} value={r.label}>
                {r.label}
              </option>
            ))}
          </Select>
        </FormField>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            style={{
              padding: "8px 18px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--status-rejected-text)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <XCircle size={13} />
            )}
            Reject
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────
const SHIFTS = ["Shift 1", "Shift 2", "NO_SHIFT"];

export function EditEntryModal({
  open,
  onClose,
  onSuccess,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: OtEntry | null;
}) {
  const [shift, setShift] = useState("");
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [manualNormal, setManualNormal] = useState(0);
  const [manualDouble, setManualDouble] = useState(0);
  const [manualTriple, setManualTriple] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entry) {
      setShift(entry.shift);
      setInTime(entry.inTime ?? "");
      setOutTime(entry.outTime ?? "");
      setReason(entry.reason ?? "");
      setManualOverride(entry.manualOverride);
      setManualNormal(entry.normalMinutes);
      setManualDouble(entry.doubleMinutes);
      setManualTriple(entry.tripleMinutes);
    }
  }, [entry]);

  if (!entry) return null;

  const isNoShift = shift === "NO_SHIFT";
  const preview =
    !manualOverride && !isNoShift && inTime && outTime
      ? calcOtMinutes({
          workDate: entry.workDate,
          shift,
          inTime,
          outTime,
          isTripleDay: false,
        })
      : null;

  async function handleEdit() {
    if (!entry) return;
    if (!isNoShift && (!inTime || !outTime)) {
      toast.error("Enter in/out times");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ot-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          shift,
          inTime,
          outTime,
          reason,
          manualOverride,
          normalMinutes: manualNormal,
          doubleMinutes: manualDouble,
          tripleMinutes: manualTriple,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Entry updated");
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to update entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit OT Entry"
      subtitle={`${entry.employee.name} · ${entry.workDate}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField label="Shift" required>
            <Select value={shift} onChange={(e) => setShift(e.target.value)}>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Work Date">
            <Input value={entry.workDate} disabled />
          </FormField>
        </div>

        {!isNoShift && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <FormField label="In Time" required>
              <Input
                type="time"
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
              />
            </FormField>
            <FormField label="Out Time" required>
              <Input
                type="time"
                value={outTime}
                onChange={(e) => setOutTime(e.target.value)}
              />
            </FormField>
          </div>
        )}

        {preview && (
          <div
            style={{
              padding: "10px 12px",
              background: "var(--brand-50)",
              border: "1px solid var(--brand-100)",
              borderRadius: "var(--radius-md)",
              fontSize: 12.5,
              color: "var(--brand-700)",
            }}
          >
            <strong>Recalculated:</strong> Normal{" "}
            {formatMinutes(preview.normalMinutes)} · Double{" "}
            {formatMinutes(preview.doubleMinutes)} · Triple{" "}
            {formatMinutes(preview.tripleMinutes)}
          </div>
        )}

        <div
          onClick={() => setManualOverride((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 12px",
            background: manualOverride
              ? "var(--status-pending-bg)"
              : "var(--bg-muted)",
            border: `1px solid ${manualOverride ? "var(--status-pending-border)" : "var(--border-base)"}`,
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <AlertTriangle
              size={12}
              color={
                manualOverride
                  ? "var(--status-pending-text)"
                  : "var(--text-muted)"
              }
            />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: manualOverride
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
              background: manualOverride
                ? "var(--status-pending-text)"
                : "var(--border-strong)",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <motion.div
              animate={{ left: manualOverride ? 16 : 2 }}
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

        <AnimatePresence>
          {manualOverride && (
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
                  gap: 10,
                }}
              >
                <FormField label="Normal (min)">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={manualNormal}
                    onChange={(e) => setManualNormal(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Double (min)">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={manualDouble}
                    onChange={(e) => setManualDouble(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Triple (min)">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={manualTriple}
                    onChange={(e) => setManualTriple(Number(e.target.value))}
                  />
                </FormField>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <FormField label="Reason / Notes">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional reason..."
          />
        </FormField>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleEdit}
            disabled={loading}
            style={{
              padding: "8px 18px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "var(--brand-500)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Pencil size={13} />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Bulk Approve Modal ───────────────────────────────────────────

interface BulkApproveModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the IDs that were successfully approved/rejected */
  onSuccess: (succeededIds: string[]) => void;
  selectedIds: string[];
  action: "approve" | "reject";
}

export function BulkApproveModal({
  open,
  onClose,
  onSuccess,
  selectedIds,
  action,
}: BulkApproveModalProps) {
  const [decisionReason, setDecisionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    succeeded: string[];
    failed: { id: string; error: string }[];
  } | null>(null);

  const { data: reasons = [] } = useQuery<DecisionReason[]>({
    queryKey: ["decision-reasons"],
    queryFn: () => fetch("/api/decision-reasons").then((r) => r.json()),
  });

  // Reset when re-opened
  useEffect(() => {
    if (open) {
      setDecisionReason("");
      setResult(null);
    }
  }, [open]);

  const filteredReasons = reasons.filter((r) =>
    action === "approve" ? r.type === "APPROVE" : r.type === "REJECT",
  );

  const isApprove = action === "approve";

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/ot-entries/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          decisionReason,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Failed");

      setResult(data);

      if (data.succeeded?.length > 0) {
        toast.success(
          `${data.succeeded.length} entr${data.succeeded.length === 1 ? "y" : "ies"} ${isApprove ? "approved" : "rejected"}`,
        );
        onSuccess(data.succeeded);
      }
      if (data.failed?.length === 0) {
        onClose();
      } else if (data.failed?.length > 0) {
        toast.error(
          `${data.failed.length} entr${data.failed.length === 1 ? "y" : "ies"} failed`,
        );
      }
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
      title={isApprove ? "Bulk Approve" : "Bulk Reject"}
      subtitle={`${selectedIds.length} entr${selectedIds.length === 1 ? "y" : "ies"} selected`}
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Count badge */}
        <div
          style={{
            padding: "12px 14px",
            background: isApprove
              ? "var(--status-approved-bg)"
              : "var(--status-rejected-bg)",
            border: `1px solid ${isApprove ? "var(--status-approved-border)" : "var(--status-rejected-border)"}`,
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {isApprove ? (
            <CheckCircle2 size={16} color="var(--status-approved-text)" />
          ) : (
            <XCircle size={16} color="var(--status-rejected-text)" />
          )}
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: isApprove
                  ? "var(--status-approved-text)"
                  : "var(--status-rejected-text)",
              }}
            >
              {selectedIds.length} pending{" "}
              {isApprove ? "approval" : "rejection"}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--text-muted)",
                marginTop: 1,
              }}
            >
              All selected entries will use their calculated OT minutes
            </div>
          </div>
        </div>

        {/* Reason */}
        <FormField label={isApprove ? "Approval Reason" : "Rejection Reason"}>
          <Select
            value={decisionReason}
            onChange={(e) => setDecisionReason(e.target.value)}
          >
            <option value="">Select reason (optional)...</option>
            {filteredReasons.map((r) => (
              <option key={r.id} value={r.label}>
                {r.label}
              </option>
            ))}
          </Select>
        </FormField>

        {/* Partial failure results */}
        {result && result.failed.length > 0 && (
          <div
            style={{
              padding: "10px 12px",
              background: "var(--status-rejected-bg)",
              border: "1px solid var(--status-rejected-border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12.5,
              color: "var(--status-rejected-text)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {result.failed.length} entries failed:
            </div>
            {result.failed.map((f) => (
              <div
                key={f.id}
                style={{ fontSize: 11.5, color: "var(--text-muted)" }}
              >
                {f.id.slice(-6)} — {f.error}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
              background: isApprove
                ? "var(--status-approved-text)"
                : "var(--status-rejected-text)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: loading ? 0.7 : 1,
              touchAction: "manipulation",
            }}
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : isApprove ? (
              <CheckCircle2 size={13} />
            ) : (
              <XCircle size={13} />
            )}
            {isApprove
              ? `Approve ${selectedIds.length}`
              : `Reject ${selectedIds.length}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
