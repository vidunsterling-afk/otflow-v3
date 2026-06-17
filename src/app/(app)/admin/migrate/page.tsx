"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Plug,
  ChevronRight,
  Eye,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Btn } from "@/components/admin/PrimaryBtn";
import { FormField, Input } from "@/components/ui/FormField";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────
interface CollectionInfo {
  name: string;
  count: number;
}
interface ConnectResult {
  collections: string[];
  counts: Record<string, number>;
  dbName: string;
}
interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
}
interface RunResult {
  success: boolean;
  results: Record<string, MigrationResult>;
}

type Step = "connect" | "configure" | "running" | "done";

// ── Collection map: MongoDB name → display info ────────────────────────────
const COLLECTION_MAP: Record<
  string,
  {
    label: string;
    description: string;
    mongoNames: string[];
    prismaKey: string;
    color: string;
    warning?: string;
  }
> = {
  employees: {
    label: "Employees",
    description: "Employee records (empId, name, addedDate)",
    mongoNames: ["employees"],
    prismaKey: "employees",
    color: "var(--brand-500)",
  },
  otEntries: {
    label: "OT Entries",
    description: "All overtime entries with minutes, status, decisions",
    mongoNames: ["otentries"],
    prismaKey: "otEntries",
    color: "var(--status-approved-text)",
    warning: "Requires employees to be migrated first (or already exist)",
  },
  tripleOtDays: {
    label: "Triple OT Days",
    description: "Dates marked as triple overtime rate",
    mongoNames: ["tripleotdays"],
    prismaKey: "tripleOtDays",
    color: "var(--status-pending-text)",
  },
  decisionReasons: {
    label: "Decision Reasons",
    description: "Approve/Reject reason labels",
    mongoNames: ["decisionreasons"],
    prismaKey: "decisionReasons",
    color: "var(--brand-600)",
  },
  users: {
    label: "Users & Roles",
    description: "System users and their roles/permissions",
    mongoNames: ["users", "roles"],
    prismaKey: "users",
    color: "var(--text-secondary)",
    warning:
      "Migrated users will need password reset if hashing differs. Unmatched roles → assigned 'viewer'",
  },
};

const CLEAR_TARGETS: Record<
  string,
  { label: string; description: string; danger: boolean }
> = {
  otEntries: {
    label: "OT Entries",
    description: "All OT entry records",
    danger: true,
  },
  employees: {
    label: "Employees",
    description: "All employee records",
    danger: true,
  },
  tripleOtDays: {
    label: "Triple OT Days",
    description: "All triple day markers",
    danger: false,
  },
  decisionReasons: {
    label: "Decision Reasons",
    description: "All approve/reject reasons",
    danger: false,
  },
  auditLogs: {
    label: "Audit Logs",
    description: "Complete audit trail",
    danger: true,
  },
  users: {
    label: "Users",
    description: "All users except your account",
    danger: true,
  },
  roles: { label: "Roles", description: "Unused roles only", danger: false },
};

// ── Live collection state type ─────────────────────────────────────────────
interface LiveCollection {
  label: string;
  migrated: number;
  skipped: number;
  errors: number;
  total: number;
  done: boolean;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function MigratePage() {
  const [step, setStep] = useState<Step>("connect");
  const [uri, setUri] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectResult, setConnectResult] = useState<ConnectResult | null>(
    null,
  );
  const [connectError, setConnectError] = useState("");

  const [migrateSelections, setMigrateSelections] = useState<
    Record<string, boolean>
  >({
    employees: true,
    otEntries: true,
    tripleOtDays: true,
    decisionReasons: true,
    users: false,
  });

  const [clearSelections, setClearSelections] = useState<
    Record<string, boolean>
  >({
    otEntries: false,
    employees: false,
    tripleOtDays: false,
    decisionReasons: false,
    auditLogs: false,
    users: false,
    roles: false,
  });

  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDone, setClearDone] = useState<Record<string, number> | null>(
    null,
  );

  const [previewCol, setPreviewCol] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>(
    {},
  );

  // Live migration progress state
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [liveCollections, setLiveCollections] = useState<
    Record<string, LiveCollection>
  >({});
  const [currentCollection, setCurrentCollection] = useState<string | null>(
    null,
  );

  // ── Connect ───────────────────────────────────────────────────────────────
  async function handleConnect() {
    if (!uri.trim()) {
      toast.error("Enter a MongoDB URI");
      return;
    }
    setConnecting(true);
    setConnectError("");
    try {
      const res = await fetch("/api/admin/migrate/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnectResult(data);
      setStep("configure");
      toast.success(`Connected to "${data.dbName}"`);
    } catch (e: any) {
      setConnectError(e.message);
    } finally {
      setConnecting(false);
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  async function handlePreview(mongoName: string) {
    if (previewCol === mongoName) {
      setPreviewCol(null);
      setPreviewData(null);
      return;
    }
    setPreviewCol(mongoName);
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch("/api/admin/migrate/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri, collection: mongoName }),
      });
      const data = await res.json();
      setPreviewData(data.sample ?? []);
    } catch {
      setPreviewData([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Clear ─────────────────────────────────────────────────────────────────
  async function handleClear() {
    const targets = Object.entries(clearSelections)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (targets.length === 0) {
      toast.error("Select at least one table to clear");
      return;
    }
    if (
      !confirm(
        `This will permanently delete data from: ${targets.join(", ")}.\n\nAre you absolutely sure?`,
      )
    )
      return;

    setClearing(true);
    try {
      const res = await fetch("/api/admin/migrate/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClearDone(data.cleared);
      toast.success("Tables cleared successfully");
      setClearSelections(
        Object.fromEntries(Object.keys(clearSelections).map((k) => [k, false])),
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClearing(false);
    }
  }

  // ── Run migration ─────────────────────────────────────────────────────────
  async function handleRun() {
    const anySelected = Object.values(migrateSelections).some(Boolean);
    if (!anySelected) {
      toast.error("Select at least one collection to migrate");
      return;
    }
    if (
      !confirm(
        "Start migration? Existing records with matching IDs will be skipped.",
      )
    )
      return;

    setRunning(true);
    setStep("running");
    setLiveLog([]);
    setLiveCollections({});
    setCurrentCollection(null);

    try {
      const res = await fetch("/api/admin/migrate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri, collections: migrateSelections }),
      });

      if (!res.ok || !res.body) throw new Error("Failed to start migration");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const eventMatch = part.match(/^event: (\w+)/m);
          const dataMatch = part.match(/^data: (.+)/m);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "status") {
            setLiveLog((p) => [...p, data.message]);
          }

          if (event === "collection_start") {
            setCurrentCollection(data.key);
            setLiveLog((p) => [...p, `▶ Starting: ${data.label}`]);
            setLiveCollections((p) => ({
              ...p,
              [data.key]: {
                label: data.label,
                migrated: 0,
                skipped: 0,
                errors: 0,
                total: 0,
                done: false,
              },
            }));
          }

          if (event === "collection_total") {
            setLiveCollections((p) => ({
              ...p,
              [data.key]: { ...p[data.key], total: data.total },
            }));
            setLiveLog((p) => [...p, `  Found ${data.total} records`]);
          }

          if (event === "collection_progress") {
            setLiveCollections((p) => ({
              ...p,
              [data.key]: {
                ...p[data.key],
                migrated: data.migrated,
                skipped: data.skipped,
                errors: data.errors,
              },
            }));
          }

          if (event === "collection_done") {
            const r = data.result;
            setLiveCollections((p) => ({
              ...p,
              [data.key]: {
                ...p[data.key],
                migrated: r.migrated,
                skipped: r.skipped,
                errors: r.errors.length,
                done: true,
              },
            }));
            setLiveLog((p) => [
              ...p,
              `  ✓ Done — ${r.migrated} migrated, ${r.skipped} skipped, ${r.errors.length} errors`,
            ]);
            setCurrentCollection(null);
          }

          if (event === "done") {
            setRunResult(data);
            setStep("done");
          }

          if (event === "error") {
            toast.error(data.message);
            setStep("configure");
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message);
      setStep("configure");
    } finally {
      setRunning(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getMongoCount(keys: string[]): number {
    if (!connectResult) return 0;
    return keys.reduce((sum, k) => sum + (connectResult.counts[k] ?? 0), 0);
  }

  const totalToMigrate = Object.entries(migrateSelections)
    .filter(([, v]) => v)
    .reduce(
      (sum, [k]) => sum + getMongoCount(COLLECTION_MAP[k]?.mongoNames ?? []),
      0,
    );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860 }}>
      <AdminPageHeader
        title="Data Migration"
        sub="Import data from OTFlow V2 (MongoDB) into OTFlow V3 (PostgreSQL)"
        icon={Database}
      />

      {/* Step indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginBottom: 24,
          background: "var(--bg-card)",
          border: "1px solid var(--border-base)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {[
          { key: "connect", label: "1. Connect", icon: Plug },
          { key: "configure", label: "2. Configure", icon: Database },
          { key: "running", label: "3. Running", icon: RefreshCw },
          { key: "done", label: "4. Done", icon: CheckCircle2 },
        ].map(({ key, label, icon: Icon }, i) => {
          const steps = ["connect", "configure", "running", "done"];
          const currentIdx = steps.indexOf(step);
          const thisIdx = steps.indexOf(key);
          const active = step === key;
          const done = thisIdx < currentIdx;

          return (
            <div
              key={key}
              style={{ flex: 1, display: "flex", alignItems: "center" }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "13px 0",
                  background: active
                    ? "var(--brand-50)"
                    : done
                      ? "var(--bg-muted)"
                      : "transparent",
                  borderRight: i < 3 ? "1px solid var(--border-base)" : "none",
                  transition: "background 0.2s",
                }}
              >
                <Icon
                  size={14}
                  color={
                    active
                      ? "var(--brand-600)"
                      : done
                        ? "var(--status-approved-text)"
                        : "var(--text-muted)"
                  }
                  className={active && key === "running" ? "animate-spin" : ""}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: active ? 700 : done ? 600 : 400,
                    color: active
                      ? "var(--brand-600)"
                      : done
                        ? "var(--status-approved-text)"
                        : "var(--text-muted)",
                  }}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Connect ─────────────────────────────────────── */}
      {step === "connect" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              Connect to OTFlow V2 MongoDB
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                marginBottom: 20,
              }}
            >
              Enter your old MongoDB connection string. The connection is used
              only for reading data during migration.
            </div>

            <FormField
              label="MongoDB URI"
              hint="e.g. mongodb+srv://user:pass@cluster.mongodb.net/otflow"
            >
              <Input
                type="password"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="mongodb+srv://..."
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
            </FormField>

            {connectError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  background: "var(--status-rejected-bg)",
                  border: "1px solid var(--status-rejected-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12.5,
                  color: "var(--status-rejected-text)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <XCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {connectError}
              </motion.div>
            )}

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Btn icon={Plug} loading={connecting} onClick={handleConnect}>
                Connect & Inspect
              </Btn>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              background: "var(--brand-50)",
              border: "1px solid var(--brand-100)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Info
              size={13}
              color="var(--brand-500)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div
              style={{
                fontSize: 12.5,
                color: "var(--brand-700)",
                lineHeight: 1.6,
              }}
            >
              Your URI is only used server-side for this migration session and
              is never stored. Make sure your MongoDB IP allowlist includes this
              server.
            </div>
          </div>
        </motion.div>
      )}

      {/* ── STEP 2: Configure ──────────────────────────────────── */}
      {step === "configure" && connectResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* DB info banner */}
          <div
            style={{
              padding: "12px 16px",
              background: "var(--status-approved-bg)",
              border: "1px solid var(--status-approved-border)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={14} color="var(--status-approved-text)" />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--status-approved-text)",
                }}
              >
                Connected to "{connectResult.dbName}"
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {connectResult.collections.length} collections found
            </div>
          </div>

          {/* ── Clear DB Section ──────────────────────────────── */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <button
              onClick={() => setClearOpen((p) => !p)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                borderBottom: clearOpen
                  ? "1px solid var(--border-base)"
                  : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--status-rejected-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={14} color="var(--status-rejected-text)" />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    Clear Existing Data
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Optionally wipe tables in the new database before migrating
                  </div>
                </div>
              </div>
              {clearOpen ? (
                <ChevronUp size={16} color="var(--text-muted)" />
              ) : (
                <ChevronDown size={16} color="var(--text-muted)" />
              )}
            </button>

            <AnimatePresence>
              {clearOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    style={{
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "var(--status-rejected-bg)",
                        border: "1px solid var(--status-rejected-border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 12.5,
                        color: "var(--status-rejected-text)",
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <AlertTriangle
                        size={13}
                        style={{ flexShrink: 0, marginTop: 1 }}
                      />
                      This permanently deletes data from the new PostgreSQL
                      database. This cannot be undone. Your current session and
                      account are always preserved.
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {Object.entries(CLEAR_TARGETS).map(([key, info]) => {
                        const checked = clearSelections[key];
                        return (
                          <label
                            key={key}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              padding: "10px 12px",
                              border: `1px solid ${checked ? (info.danger ? "var(--status-rejected-border)" : "var(--brand-200)") : "var(--border-base)"}`,
                              borderRadius: "var(--radius-md)",
                              background: checked
                                ? info.danger
                                  ? "var(--status-rejected-bg)"
                                  : "var(--brand-50)"
                                : "var(--bg-muted)",
                              cursor: "pointer",
                              transition: "all 0.12s",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setClearSelections((p) => ({
                                  ...p,
                                  [key]: e.target.checked,
                                }))
                              }
                              style={{
                                marginTop: 2,
                                flexShrink: 0,
                                accentColor: info.danger
                                  ? "var(--status-rejected-text)"
                                  : "var(--brand-500)",
                              }}
                            />
                            <div>
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: checked
                                    ? info.danger
                                      ? "var(--status-rejected-text)"
                                      : "var(--brand-600)"
                                    : "var(--text-secondary)",
                                }}
                              >
                                {info.label}
                                {info.danger && (
                                  <span
                                    style={{
                                      marginLeft: 5,
                                      fontSize: 9,
                                      fontWeight: 700,
                                      letterSpacing: "0.5px",
                                      color: "var(--status-rejected-text)",
                                    }}
                                  >
                                    DANGER
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  marginTop: 1,
                                }}
                              >
                                {info.description}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {clearDone && (
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "var(--status-approved-bg)",
                          border: "1px solid var(--status-approved-border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12.5,
                          color: "var(--status-approved-text)",
                        }}
                      >
                        <strong>Cleared:</strong>{" "}
                        {Object.entries(clearDone)
                          .map(([k, v]) => `${k}: ${v} rows`)
                          .join(" · ")}
                      </div>
                    )}

                    <div
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      <Btn
                        icon={Trash2}
                        variant="danger"
                        loading={clearing}
                        onClick={handleClear}
                      >
                        Clear Selected Tables
                      </Btn>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Migration Collection Selector ─────────────────── */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-base)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  Select Collections to Migrate
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 1,
                  }}
                >
                  Choose what to import from the old MongoDB database
                </div>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--brand-600)",
                  background: "var(--brand-50)",
                  padding: "3px 10px",
                  borderRadius: 99,
                  border: "1px solid var(--brand-100)",
                }}
              >
                {totalToMigrate} records selected
              </div>
            </div>

            <div
              style={{
                padding: "12px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {Object.entries(COLLECTION_MAP).map(([key, info]) => {
                const checked = migrateSelections[key];
                const count = getMongoCount(info.mongoNames);
                const available = info.mongoNames.some((n) =>
                  connectResult.collections.includes(n),
                );

                return (
                  <div key={key}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "12px 14px",
                        border: `1px solid ${checked ? "var(--brand-200)" : "var(--border-base)"}`,
                        borderRadius: "var(--radius-md)",
                        background: checked
                          ? "var(--brand-50)"
                          : "var(--bg-muted)",
                        cursor: available ? "pointer" : "not-allowed",
                        opacity: available ? 1 : 0.5,
                        transition: "all 0.12s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!available}
                        onChange={(e) =>
                          setMigrateSelections((p) => ({
                            ...p,
                            [key]: e.target.checked,
                          }))
                        }
                        style={{
                          marginTop: 3,
                          flexShrink: 0,
                          accentColor: "var(--brand-500)",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: checked
                                ? "var(--brand-700)"
                                : "var(--text-primary)",
                            }}
                          >
                            {info.label}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: checked
                                  ? "var(--brand-600)"
                                  : "var(--text-muted)",
                              }}
                            >
                              {count.toLocaleString()} records
                            </span>
                            {available && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handlePreview(info.mongoNames[0]);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "3px 8px",
                                  borderRadius: "var(--radius-sm)",
                                  border: "1px solid var(--border-base)",
                                  background: "var(--bg-card)",
                                  fontSize: 11,
                                  color: "var(--text-secondary)",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={10} />
                                {previewCol === info.mongoNames[0]
                                  ? "Hide"
                                  : "Preview"}
                              </button>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginTop: 2,
                          }}
                        >
                          {info.description}
                          {!available && " · Not found in source DB"}
                        </div>
                        {info.warning && checked && (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 11.5,
                              color: "var(--status-pending-text)",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 5,
                            }}
                          >
                            <AlertTriangle
                              size={11}
                              style={{ flexShrink: 0, marginTop: 1 }}
                            />
                            {info.warning}
                          </div>
                        )}
                      </div>
                    </label>

                    {/* Preview panel */}
                    <AnimatePresence>
                      {previewCol === info.mongoNames[0] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: "hidden" }}
                        >
                          <div
                            style={{
                              margin: "6px 0 0 26px",
                              border: "1px solid var(--border-base)",
                              borderRadius: "var(--radius-md)",
                              overflow: "auto",
                              maxHeight: 200,
                              background: "var(--bg-muted)",
                            }}
                          >
                            {previewLoading ? (
                              <div
                                style={{
                                  padding: "20px 0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 8,
                                  color: "var(--text-muted)",
                                  fontSize: 13,
                                }}
                              >
                                <Loader2 size={14} className="animate-spin" />{" "}
                                Loading preview...
                              </div>
                            ) : (
                              <pre
                                style={{
                                  fontSize: 11,
                                  padding: 12,
                                  margin: 0,
                                  color: "var(--text-secondary)",
                                  fontFamily: "var(--font-geist-mono)",
                                  lineHeight: 1.5,
                                }}
                              >
                                {JSON.stringify(previewData, null, 2)}
                              </pre>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Run button */}
            <div
              style={{
                padding: "14px 18px",
                borderTop: "1px solid var(--border-base)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-muted)",
              }}
            >
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Existing records with matching keys will be{" "}
                <strong>skipped</strong>, not overwritten.
              </div>
              <Btn icon={Play} onClick={handleRun}>
                Run Migration
              </Btn>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── STEP 3: Running ───────────────────────────────────── */}
      {step === "running" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {/* Header */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--brand-50)",
                border: "1px solid var(--brand-100)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <RefreshCw
                size={18}
                color="var(--brand-500)"
                className="animate-spin"
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Migration in progress
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                Do not close this tab.
              </div>
            </div>
          </div>

          {/* Per-collection progress cards */}
          {Object.entries(liveCollections).map(([key, col]) => {
            const processed = col.migrated + col.skipped + col.errors;
            const pct =
              col.total > 0
                ? Math.min(100, Math.round((processed / col.total) * 100))
                : 0;
            const isActive = currentCollection === key;

            return (
              <div
                key={key}
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${col.done ? "var(--status-approved-border)" : isActive ? "var(--brand-200)" : "var(--border-base)"}`,
                  borderRadius: "var(--radius-lg)",
                  padding: "14px 18px",
                  boxShadow: "var(--shadow-card)",
                  transition: "border-color 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      {col.done ? (
                        <CheckCircle2
                          size={14}
                          color="var(--status-approved-text)"
                        />
                      ) : isActive ? (
                        <Loader2
                          size={14}
                          color="var(--brand-500)"
                          className="animate-spin"
                        />
                      ) : (
                        <Database size={14} color="var(--text-muted)" />
                      )}
                      {col.label}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11.5 }}>
                    <span
                      style={{
                        color: "var(--status-approved-text)",
                        fontWeight: 600,
                      }}
                    >
                      ✓ {col.migrated}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>
                      ↷ {col.skipped}
                    </span>
                    {col.errors > 0 && (
                      <span
                        style={{
                          color: "var(--status-rejected-text)",
                          fontWeight: 600,
                        }}
                      >
                        ✗ {col.errors}
                      </span>
                    )}
                    <span style={{ color: "var(--text-muted)" }}>
                      {col.total > 0 ? `${processed}/${col.total}` : "..."}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 5,
                    background: "var(--bg-muted)",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: col.done
                        ? "var(--status-approved-text)"
                        : "var(--brand-500)",
                      borderRadius: 99,
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
                {col.total > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 4,
                      textAlign: "right",
                    }}
                  >
                    {pct}%
                  </div>
                )}
              </div>
            );
          })}

          {/* Live log */}
          <div
            style={{
              background: "var(--bg-muted)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              padding: "12px 14px",
              maxHeight: 180,
              overflowY: "auto",
              fontFamily: "var(--font-geist-mono)",
              fontSize: 11.5,
              color: "var(--text-secondary)",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            {liveLog.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>
                Initializing...
              </span>
            ) : (
              liveLog.map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </motion.div>
      )}

      {/* ── STEP 4: Done ─────────────────────────────────────── */}
      {step === "done" && runResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div
            style={{
              padding: "16px 18px",
              background: "var(--status-approved-bg)",
              border: "1px solid var(--status-approved-border)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <CheckCircle2 size={20} color="var(--status-approved-text)" />
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--status-approved-text)",
                }}
              >
                Migration Complete
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                  marginTop: 1,
                }}
              >
                All selected collections have been processed.
              </div>
            </div>
          </div>

          {/* Results per collection */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(runResult.results).map(([key, result]) => {
              const info = COLLECTION_MAP[key];
              const hasErrors = result.errors.length > 0;
              const errExpanded = expandedErrors[key];

              return (
                <div
                  key={key}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-base)",
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--brand-50)",
                        border: "1px solid var(--brand-100)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Database size={16} color="var(--brand-500)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {info?.label ?? key}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          marginTop: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--status-approved-text)",
                            fontWeight: 600,
                          }}
                        >
                          ✓ {result.migrated} migrated
                        </span>
                        {result.skipped > 0 && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              fontWeight: 500,
                            }}
                          >
                            ↷ {result.skipped} skipped
                          </span>
                        )}
                        {hasErrors && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--status-rejected-text)",
                              fontWeight: 600,
                            }}
                          >
                            ✗ {result.errors.length} errors
                          </span>
                        )}
                      </div>
                    </div>
                    {hasErrors && (
                      <button
                        onClick={() =>
                          setExpandedErrors((p) => ({ ...p, [key]: !p[key] }))
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 10px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--status-rejected-border)",
                          background: "var(--status-rejected-bg)",
                          fontSize: 11.5,
                          color: "var(--status-rejected-text)",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {errExpanded ? (
                          <ChevronUp size={11} />
                        ) : (
                          <ChevronDown size={11} />
                        )}
                        View errors
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {hasErrors && errExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div
                          style={{
                            borderTop:
                              "1px solid var(--status-rejected-border)",
                            background: "var(--status-rejected-bg)",
                            padding: "12px 18px",
                            maxHeight: 200,
                            overflowY: "auto",
                          }}
                        >
                          {result.errors.map((err, i) => (
                            <div
                              key={i}
                              style={{
                                fontSize: 11.5,
                                color: "var(--status-rejected-text)",
                                fontFamily: "var(--font-geist-mono)",
                                padding: "3px 0",
                                borderBottom:
                                  i < result.errors.length - 1
                                    ? "1px solid var(--status-rejected-border)"
                                    : "none",
                              }}
                            >
                              {err}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn
              variant="ghost"
              icon={RefreshCw}
              onClick={() => {
                setStep("configure");
                setRunResult(null);
              }}
            >
              Run Again
            </Btn>
            <Btn
              icon={ChevronRight}
              onClick={() => (window.location.href = "/dashboard")}
            >
              Go to Dashboard
            </Btn>
          </div>
        </motion.div>
      )}
    </div>
  );
}
