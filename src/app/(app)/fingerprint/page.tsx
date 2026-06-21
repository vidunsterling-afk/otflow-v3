"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  RefreshCw,
  FileText,
  Eye,
  EyeOff,
  Upload,
  CheckCircle2,
  ScanLine,
  X,
  Settings2,
  Info,
  Moon,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sun,
  Sunset,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Btn } from "@/components/admin/PrimaryBtn";
import { Modal } from "@/components/ui/Modal";

type LogType = "IN" | "OUT" | "MIDDLE";

interface ProcessedLog {
  empId: string;
  date: string;
  time: string;
  hour: number;
  type: LogType;
  shift: string;
  note: string;
}

interface FingerprintSettings {
  nightOutStartHour: number;
  nightOutEndHour: number;
  morningInStartHour: number;
  morningInEndHour: number;
  eveningOutStartHour: number;
  eveningOutEndHour: number;
  middlePunchMode: "ignore" | "label";
  shift1StartHour: number;
  shift1EndHour: number;
  shift2StartHour: number;
  shift2EndHour: number;
}

const DEFAULT_SETTINGS: FingerprintSettings = {
  nightOutStartHour: 0,
  nightOutEndHour: 5,
  morningInStartHour: 6,
  morningInEndHour: 11,
  eveningOutStartHour: 13,
  eveningOutEndHour: 23,
  middlePunchMode: "ignore",
  shift1StartHour: 5,
  shift1EndHour: 7,
  shift2StartHour: 8,
  shift2EndHour: 11,
};

// ── Hour picker ───────────────────────────────────────────────────────────────
function HourRange({
  startVal,
  endVal,
  onStartChange,
  onEndChange,
  startLabel,
  endLabel,
}: {
  startVal: number;
  endVal: number;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;
  startLabel: string;
  endLabel: string;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}
        >
          {startLabel}
        </div>
        <select
          value={startVal}
          onChange={(e) => onStartChange(Number(e.target.value))}
          style={{
            width: "100%",
            padding: "7px 10px",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "var(--text-primary)",
            background: "var(--bg-base)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          {hours.map((h) => (
            <option key={h} value={h}>
              {fmt(h)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ color: "var(--text-muted)", marginTop: 16 }}>→</div>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}
        >
          {endLabel}
        </div>
        <select
          value={endVal}
          onChange={(e) => onEndChange(Number(e.target.value))}
          style={{
            width: "100%",
            padding: "7px 10px",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "var(--text-primary)",
            background: "var(--bg-base)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          {hours.map((h) => (
            <option key={h} value={h}>
              {fmt(h)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Setting block ─────────────────────────────────────────────────────────────
function Block({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  example,
  children,
}: {
  icon: any;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  example?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border-base)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        background: "var(--bg-card)",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border-base)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={iconColor} />
        </div>
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--text-secondary)",
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
          {example && (
            <div
              style={{
                marginTop: 6,
                padding: "6px 10px",
                background: "var(--brand-50)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--brand-100)",
                fontSize: 11.5,
                color: "var(--brand-700)",
                lineHeight: 1.5,
              }}
            >
              <strong>Example:</strong> {example}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

// ── Settings Modal ─────────────────────────────────────────────────────────────
function SettingsModal({
  open,
  onClose,
  settings,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  settings: FingerprintSettings;
  onSave: (s: FingerprintSettings) => void;
}) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [showShiftSettings, setShowShiftSettings] = useState(false);

  useEffect(() => {
    setLocal(settings);
  }, [settings, open]);

  function set<K extends keyof FingerprintSettings>(
    k: K,
    v: FingerprintSettings[K],
  ) {
    setLocal((p) => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/fingerprint/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
      });
      if (!res.ok) throw new Error();
      onSave(local);
      toast.success("Settings saved — re-upload your file to apply");
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // Preview of current time windows
  const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fingerprint Algorithm Settings"
      subtitle="Tell the system what each scan means based on time of day"
      width={600}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* How it works banner */}
        <div
          style={{
            padding: "12px 14px",
            background: "var(--brand-50)",
            border: "1px solid var(--brand-100)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--brand-700)",
              marginBottom: 6,
            }}
          >
            How this works
          </div>
          <div
            style={{ fontSize: 12, color: "var(--brand-700)", lineHeight: 1.7 }}
          >
            The fingerprint machine records every scan but doesn't reliably tell
            us if it's an arrival or departure. Instead, we use the{" "}
            <strong>time of day</strong> to figure that out. You define three
            time windows below — the system uses them to classify every scan
            automatically.
          </div>
          {/* Visual timeline */}
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              background: "white",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--brand-100)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              Current time windows:
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                {
                  label: "Night OUT",
                  range: `${fmt(local.nightOutStartHour)} – ${fmt(local.nightOutEndHour)}`,
                  bg: "var(--brand-50)",
                  color: "var(--brand-600)",
                  icon: "🌙",
                },
                {
                  label: "Morning IN",
                  range: `${fmt(local.morningInStartHour)} – ${fmt(local.morningInEndHour)}`,
                  bg: "var(--status-approved-bg)",
                  color: "var(--status-approved-text)",
                  icon: "🌅",
                },
                {
                  label: "Evening OUT",
                  range: `${fmt(local.eveningOutStartHour)} – ${fmt(local.eveningOutEndHour)}`,
                  bg: "var(--status-rejected-bg)",
                  color: "var(--status-rejected-text)",
                  icon: "🌇",
                },
              ].map(({ label, range, bg, color, icon }) => (
                <div
                  key={label}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "var(--radius-sm)",
                    background: bg,
                    fontSize: 11.5,
                    color,
                    fontWeight: 600,
                  }}
                >
                  {icon} {label}: {range}
                </div>
              ))}
              <div
                style={{
                  padding: "5px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-muted)",
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                ⏱ Middle: everything else (
                {local.middlePunchMode === "ignore" ? "ignored" : "labeled"})
              </div>
            </div>
          </div>
        </div>

        {/* ── Window 1: Night OUT ──────────────────────────────── */}
        <Block
          icon={Moon}
          iconColor="var(--brand-600)"
          iconBg="var(--brand-50)"
          title="🌙 Night OUT window — end of night shift"
          description="Scans that happen late at night or just after midnight mean the employee is leaving after a night shift. The system will label these as OUT and link them to the previous calendar day."
          example="Employee works until 00:30 AM. Their midnight scan is OUT for the shift that started the previous evening."
        >
          <HourRange
            startVal={local.nightOutStartHour}
            endVal={local.nightOutEndHour}
            onStartChange={(v) => set("nightOutStartHour", v)}
            onEndChange={(v) => set("nightOutEndHour", v)}
            startLabel="Night OUT starts from"
            endLabel="Night OUT ends before"
          />
          <div
            style={{
              marginTop: 8,
              padding: "7px 10px",
              background: "var(--bg-muted)",
              borderRadius: "var(--radius-sm)",
              fontSize: 11.5,
              color: "var(--text-muted)",
            }}
          >
            💡 Scans in this window are automatically moved to the{" "}
            <strong>previous day</strong> in the output. For your data: most
            midnight punches are around 00:00–00:35.
          </div>
        </Block>

        {/* ── Window 2: Morning IN ─────────────────────────────── */}
        <Block
          icon={Sun}
          iconColor="var(--status-approved-text)"
          iconBg="var(--status-approved-bg)"
          title="🌅 Morning IN window — start of day shift"
          description="Scans in the morning mean the employee is arriving for their day shift. The system labels these as IN."
          example="Shift 1 employees arrive around 6:30 AM, Shift 2 around 8:30 AM — both fall in this morning window."
        >
          <HourRange
            startVal={local.morningInStartHour}
            endVal={local.morningInEndHour}
            onStartChange={(v) => set("morningInStartHour", v)}
            onEndChange={(v) => set("morningInEndHour", v)}
            startLabel="Morning IN starts from"
            endLabel="Morning IN ends before"
          />
        </Block>

        {/* ── Window 3: Evening OUT ────────────────────────────── */}
        <Block
          icon={Sunset}
          iconColor="var(--status-rejected-text)"
          iconBg="var(--status-rejected-bg)"
          title="🌇 Evening OUT window — end of day shift"
          description="Scans in the afternoon or evening mean the employee is leaving after their day shift. The system labels these as OUT."
          example="Shift 1 leaves around 3:30 PM, Shift 2 leaves around 5:30 PM — both fall in this evening window."
        >
          <HourRange
            startVal={local.eveningOutStartHour}
            endVal={local.eveningOutEndHour}
            onStartChange={(v) => set("eveningOutStartHour", v)}
            onEndChange={(v) => set("eveningOutEndHour", v)}
            startLabel="Evening OUT starts from"
            endLabel="Evening OUT ends before"
          />
        </Block>

        {/* ── Middle punches ───────────────────────────────────── */}
        <Block
          icon={Clock}
          iconColor="var(--status-pending-text)"
          iconBg="var(--status-pending-bg)"
          title="⏱ Middle-of-day punches — lunch, errands, etc."
          description="Sometimes an employee scans during the middle of their shift — for example, going out for lunch and coming back. These punches don't fit the morning IN or evening OUT windows. What should the system do with them?"
          example="Employee scans at 12:30 PM while already IN for the day. This is likely a lunch trip."
        >
          <div style={{ display: "flex", gap: 10 }}>
            {[
              {
                val: "ignore" as const,
                label: "Show as MIDDLE (no count)",
                sub: "Show middle scans in the table labeled MIDDLE but don't count them in shift totals.",
                icon: "👁️",
              },
              {
                val: "label" as const,
                label: "Show them as MIDDLE",
                sub: "Include them in the output labeled as MIDDLE. Useful if you want to track who went out.",
                icon: "🏷️",
              },
            ].map(({ val, label, sub, icon }) => (
              <button
                key={val}
                onClick={() => set("middlePunchMode", val)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  textAlign: "left",
                  border: `2px solid ${local.middlePunchMode === val ? "var(--brand-400)" : "var(--border-base)"}`,
                  borderRadius: "var(--radius-md)",
                  background:
                    local.middlePunchMode === val
                      ? "var(--brand-50)"
                      : "var(--bg-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 3,
                  }}
                >
                  {icon} {label}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {sub}
                </div>
              </button>
            ))}
          </div>
        </Block>

        {/* ── Shift detection (collapsible) ────────────────────── */}
        <button
          onClick={() => setShowShiftSettings((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-muted)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-secondary)",
            width: "100%",
          }}
        >
          <Settings2 size={14} />
          Shift Detection Settings
          {showShiftSettings ? (
            <ChevronUp size={13} />
          ) : (
            <ChevronDown size={13} />
          )}
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11.5,
              fontWeight: 400,
              color: "var(--text-muted)",
            }}
          >
            Which arrival times = Shift 1 vs Shift 2
          </span>
        </button>

        <AnimatePresence>
          {showShiftSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <Block
                icon={AlertTriangle}
                iconColor="var(--brand-600)"
                iconBg="var(--brand-50)"
                title="Shift 1 vs Shift 2 detection"
                description="When an employee arrives in the morning, the system can automatically figure out which shift they're on based on what time they arrived. Set the arrival time ranges for each shift below."
                example="Shift 1 starts at 6:30 AM so anyone arriving between 5:00–7:59 AM is Shift 1. Shift 2 starts at 8:30 AM so anyone arriving 8:00–11:59 AM is Shift 2."
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--brand-600)",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          padding: "1px 7px",
                          borderRadius: 99,
                          background: "var(--brand-50)",
                          border: "1px solid var(--brand-100)",
                          fontSize: 11,
                        }}
                      >
                        Shift 1 — starts 6:30 AM
                      </span>
                    </div>
                    <HourRange
                      startVal={local.shift1StartHour}
                      endVal={local.shift1EndHour}
                      onStartChange={(v) => set("shift1StartHour", v)}
                      onEndChange={(v) => set("shift1EndHour", v)}
                      startLabel="Arrivals from"
                      endLabel="Arrivals until"
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--status-pending-text)",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          padding: "1px 7px",
                          borderRadius: 99,
                          background: "var(--status-pending-bg)",
                          border: "1px solid var(--status-pending-border)",
                          fontSize: 11,
                        }}
                      >
                        Shift 2 — starts 8:30 AM
                      </span>
                    </div>
                    <HourRange
                      startVal={local.shift2StartHour}
                      endVal={local.shift2EndHour}
                      onStartChange={(v) => set("shift2StartHour", v)}
                      onEndChange={(v) => set("shift2EndHour", v)}
                      startLabel="Arrivals from"
                      endLabel="Arrivals until"
                    />
                  </div>
                </div>
              </Block>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            paddingTop: 4,
            borderTop: "1px solid var(--border-base)",
          }}
        >
          <button
            onClick={() => setLocal(DEFAULT_SETTINGS)}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-base)",
              background: "transparent",
              fontSize: 12.5,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            Reset to defaults
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>
              Cancel
            </Btn>
            <Btn icon={Settings2} loading={saving} onClick={handleSave}>
              Save Settings
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FingerprintPage() {
  const [logs, setLogs] = useState<ProcessedLog[]>([]);
  const [csv, setCsv] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showType, setShowType] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [fileName, setFileName] = useState("");
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] =
    useState<FingerprintSettings>(DEFAULT_SETTINGS);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/fingerprint/settings")
      .then((r) => r.json())
      .then((d) => setSettings({ ...DEFAULT_SETTINGS, ...d }))
      .catch(() => {});
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setLogs([]);
    setCsv("");
    setStats(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/fingerprint/process", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setLogs(data.logs);
      setCsv(data.csv);
      setStats(data.stats);
      toast.success(
        `Processed ${data.stats.rawCount} raw scans → ${data.logs.length} records` +
          (data.stats.middleCount > 0
            ? ` · ${data.stats.middleCount} middle punches shown`
            : ""),
      );
    } catch (e: any) {
      toast.error(e.message);
      setFileName("");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function handleDownload() {
    if (!csv) return;
    let out = csv;
    if (!showType) {
      out = csv
        .split("\n")
        .map((l) => l.split(",").slice(0, 3).join(","))
        .join("\n");
    }
    const blob = new Blob([out], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fingerprint_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  const filtered = logs.filter(
    (l) =>
      !search ||
      l.empId.toLowerCase().includes(search.toLowerCase()) ||
      l.date.includes(search) ||
      l.shift.toLowerCase().includes(search.toLowerCase()),
  );

  const uniqueEmps = new Set(logs.map((l) => l.empId)).size;
  const uniqueDates = new Set(logs.map((l) => l.date)).size;

  function TypeBadge({ type }: { type: LogType }) {
    const map: Record<LogType, { bg: string; color: string }> = {
      IN: {
        bg: "var(--status-approved-bg)",
        color: "var(--status-approved-text)",
      },
      OUT: {
        bg: "var(--status-rejected-bg)",
        color: "var(--status-rejected-text)",
      },
      MIDDLE: {
        bg: "var(--status-pending-bg)",
        color: "var(--status-pending-text)",
      },
    };
    const s = map[type];
    return (
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 99,
          background: s.bg,
          color: s.color,
        }}
      >
        {type}
      </span>
    );
  }

  function ShiftBadge({ shift }: { shift: string }) {
    const isS1 = shift === "Shift 1";
    const isS2 = shift === "Shift 2";
    return (
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 99,
          background: isS1
            ? "var(--brand-50)"
            : isS2
              ? "var(--status-pending-bg)"
              : "var(--bg-muted)",
          color: isS1
            ? "var(--brand-600)"
            : isS2
              ? "var(--status-pending-text)"
              : "var(--text-muted)",
        }}
      >
        {shift}
      </span>
    );
  }

  const cols = [
    "90px",
    "120px",
    "130px",
    "100px",
    ...(showType ? ["80px"] : []),
    ...(showType ? ["100px"] : []),
    ...(showNotes ? ["1fr"] : []),
  ].join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AdminPageHeader
        title="Fingerprint Logs"
        sub="Upload raw TXT logs from fingerprint machines — smart IN/OUT detection"
        icon={ScanLine}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
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
              <Settings2 size={13} /> Algorithm Settings
            </button>
            {logs.length > 0 && (
              <>
                <button
                  onClick={() => setShowNotes((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 12px",
                    height: 34,
                    border: "1px solid var(--border-base)",
                    borderRadius: "var(--radius-md)",
                    background: showNotes
                      ? "var(--brand-50)"
                      : "var(--bg-card)",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: showNotes
                      ? "var(--brand-600)"
                      : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <HelpCircle size={13} /> {showNotes ? "Hide" : "Show"} Notes
                </button>
                <button
                  onClick={() => setShowType((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
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
                  {showType ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showType ? "Hide Type" : "Show Type"}
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 14px",
                    height: 34,
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    background: "var(--status-approved-text)",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Download size={14} /> Download CSV
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Upload */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-base)",
          borderRadius: "var(--radius-lg)",
          padding: 20,
          boxShadow: "var(--shadow-card)",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".txt"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        {!fileName ? (
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: "100%",
              padding: "28px 0",
              border: "2px dashed var(--border-strong)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-muted)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--brand-300)";
              (e.currentTarget as HTMLElement).style.background =
                "var(--brand-50)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "var(--border-strong)";
              (e.currentTarget as HTMLElement).style.background =
                "var(--bg-muted)";
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Upload size={20} color="var(--text-muted)" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                Click to upload fingerprint TXT file
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                Raw export from fingerprint machine · .txt format
              </div>
            </div>
          </button>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              border: "1px solid var(--status-approved-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--status-approved-bg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={16} color="var(--status-approved-text)" />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--status-approved-text)",
                  }}
                >
                  {fileName}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {stats?.rawCount} raw scans · {logs.length} processed records
                  · {uniqueEmps} employees · {uniqueDates} dates
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: "5px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-base)",
                  background: "var(--bg-card)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Upload another
              </button>
              <button
                onClick={() => {
                  setLogs([]);
                  setCsv("");
                  setFileName("");
                  setStats(null);
                  setSearch("");
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-base)",
                  background: "var(--bg-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "32px 0",
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <RefreshCw
              size={16}
              color="var(--brand-500)"
              className="animate-spin"
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Processing with smart algorithm...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      {stats && !loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {[
            {
              label: "Raw Scans",
              value: stats.rawCount,
              color: "var(--text-secondary)",
            },
            {
              label: "IN Punches",
              value: stats.inCount,
              color: "var(--status-approved-text)",
            },
            {
              label: "OUT Punches",
              value: stats.outCount,
              color: "var(--status-rejected-text)",
            },
            {
              label: "Middle Punches",
              value: stats.middleCount,
              color: "var(--status-pending-text)",
            },
            {
              label: "Shift 1",
              value: stats.shift1Count,
              color: "var(--brand-500)",
            },
            {
              label: "Shift 2",
              value: stats.shift2Count,
              color: "var(--status-pending-text)",
            },
          ].map(({ label, value, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.5px",
                }}
              >
                {value}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Table */}
      {logs.length > 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-base)",
              background: "var(--bg-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={14} color="var(--text-secondary)" />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Processed Logs
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: 99,
                  background: "var(--brand-50)",
                  color: "var(--brand-600)",
                  border: "1px solid var(--brand-100)",
                }}
              >
                {filtered.length} records
              </span>
            </div>
            <input
              placeholder="Search by Emp ID, date or shift..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "5px 10px",
                width: 240,
                border: "1px solid var(--border-base)",
                borderRadius: "var(--radius-md)",
                fontSize: 12.5,
                color: "var(--text-primary)",
                background: "var(--bg-base)",
                outline: "none",
              }}
            />
          </div>

          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              padding: "9px 16px",
              borderBottom: "1px solid var(--border-base)",
              background: "var(--bg-muted)",
              gap: 12,
            }}
          >
            {[
              "Emp ID",
              "Date",
              "Time",
              "Logical Date",
              ...(showType ? ["Type", "Shift"] : []),
              ...(showNotes ? ["System Note"] : []),
            ].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "32px 0",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                No records match
              </div>
            ) : (
              filtered.map((log, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: cols,
                    padding: "9px 16px",
                    borderBottom:
                      i < filtered.length - 1
                        ? "1px solid var(--border-base)"
                        : "none",
                    alignItems: "center",
                    gap: 12,
                    transition: "background 0.1s",
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
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--brand-600)",
                      fontFamily: "var(--font-geist-mono)",
                      background: "var(--brand-50)",
                      padding: "2px 7px",
                      borderRadius: 99,
                      display: "inline-block",
                      width: "fit-content",
                    }}
                  >
                    {log.empId}
                  </div>
                  <div
                    style={{ fontSize: 12.5, color: "var(--text-secondary)" }}
                  >
                    {log.date}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-geist-mono)",
                    }}
                  >
                    {log.time}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {log.date}
                  </div>
                  {showType && <TypeBadge type={log.type} />}
                  {showType && <ShiftBadge shift={log.shift} />}
                  {showNotes && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      {log.note}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
    </div>
  );
}
