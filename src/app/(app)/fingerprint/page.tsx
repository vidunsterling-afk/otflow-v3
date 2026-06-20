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
  AlertTriangle,
  Moon,
  Coffee,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FormField, Input } from "@/components/ui/FormField";
import { Btn } from "@/components/admin/PrimaryBtn";
import { Modal } from "@/components/ui/Modal";
import { motion as m } from "framer-motion";

type LogType = "IN" | "OUT" | "BREAK_OUT" | "BREAK_IN";

interface Log {
  empId: string;
  date: string;
  time: string;
  type: LogType;
  shiftIndex: number;
  note?: string;
}

interface FingerprintSettings {
  shiftGapHours: number;
  breakMaxMinutes: number;
  enableBreakTracking: boolean;
  nightShiftMode: boolean;
  firstPunchIsIn: boolean;
  minShiftMinutes: number;
}

const DEFAULT_SETTINGS: FingerprintSettings = {
  shiftGapHours: 5,
  breakMaxMinutes: 60,
  enableBreakTracking: false,
  nightShiftMode: false,
  firstPunchIsIn: true,
  minShiftMinutes: 1,
};

// ── Setting explanation card ──────────────────────────────────────────────────
function SettingCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  example,
  children,
  advanced,
}: {
  icon: any;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  example?: string;
  children: React.ReactNode;
  advanced?: boolean;
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
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border-base)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          background: advanced ? "var(--bg-muted)" : "var(--bg-card)",
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
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {title}
            </div>
            {advanced && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 99,
                  background: "var(--brand-100)",
                  color: "var(--brand-600)",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                Advanced
              </span>
            )}
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
      {/* Control */}
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({
  value,
  onChange,
  label,
  onLabel = "On",
  offLabel = "Off",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 48,
          height: 26,
          borderRadius: 99,
          background: value ? "var(--brand-500)" : "var(--border-strong)",
          border: "none",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ left: value ? 24 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            position: "absolute",
            top: 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: value ? "var(--brand-600)" : "var(--text-muted)",
        }}
      >
        {value ? onLabel : offLabel}
      </span>
      {label && (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ── Number slider ─────────────────────────────────────────────────────────────
function NumberSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  lowLabel,
  highLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  lowLabel?: string;
  highLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            flex: 1,
            accentColor: "var(--brand-500)",
            cursor: "pointer",
          }}
        />
        <div
          style={{
            minWidth: 64,
            padding: "4px 10px",
            background: "var(--brand-50)",
            border: "1px solid var(--brand-100)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--brand-600)",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          {value} {unit}
        </div>
      </div>
      {(lowLabel || highLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {lowLabel}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {highLabel}
          </span>
        </div>
      )}
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
  const [local, setLocal] = useState<FingerprintSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLocal(settings);
  }, [settings, open]);

  function update<K extends keyof FingerprintSettings>(
    key: K,
    val: FingerprintSettings[K],
  ) {
    setLocal((p) => ({ ...p, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/fingerprint/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSave(local);
      toast.success("Settings saved — re-upload your file to apply changes");
      onClose();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setLocal(DEFAULT_SETTINGS);
    toast.info("Reset to defaults — click Save to apply");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fingerprint Algorithm Settings"
      subtitle="Configure how the system interprets punch records"
      width={580}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Info banner */}
        <div
          style={{
            padding: "10px 12px",
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
            These settings control how the system figures out whether each
            fingerprint scan is an arrival (IN) or departure (OUT). If your
            results look wrong, adjust these settings to match how your
            workplace operates.
            <strong> After changing settings, re-upload your file</strong> to
            see updated results.
          </div>
        </div>

        {/* ── Setting 1: First punch ─────────────────────────── */}
        <SettingCard
          icon={Zap}
          iconColor="var(--brand-600)"
          iconBg="var(--brand-50)"
          title="What does the first scan of the day mean?"
          description="When an employee scans for the very first time on a given day, should the system treat it as them arriving (IN) or leaving (OUT)?"
          example='If your staff arrive and scan in the morning, choose "Arriving (IN)". If your file captures people leaving from a night shift first, choose "Leaving (OUT)".'
        >
          <div style={{ display: "flex", gap: 10 }}>
            {[
              {
                val: true,
                label: "🟢 Arriving (IN)",
                sub: "Most common — staff arrive first",
              },
              {
                val: false,
                label: "🔴 Leaving (OUT)",
                sub: "Night shift ending first",
              },
            ].map(({ val, label, sub }) => (
              <button
                key={String(val)}
                onClick={() => update("firstPunchIsIn", val)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: `2px solid ${local.firstPunchIsIn === val ? "var(--brand-400)" : "var(--border-base)"}`,
                  borderRadius: "var(--radius-md)",
                  background:
                    local.firstPunchIsIn === val
                      ? "var(--brand-50)"
                      : "var(--bg-muted)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 2,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {sub}
                </div>
              </button>
            ))}
          </div>
        </SettingCard>

        {/* ── Setting 2: Shift gap ────────────────────────────── */}
        <SettingCard
          icon={Clock}
          iconColor="var(--status-pending-text)"
          iconBg="var(--status-pending-bg)"
          title="How long is a normal break between shifts?"
          description="If two scans from the same person are more than this many hours apart, the system assumes a new shift has started — the first scan after the gap is treated as a new IN."
          example="If you set this to 5 hours: an employee who scans at 17:30 (OUT) and then again at 22:00 (less than 5h gap) is seen as still in the same day. But if they scan next at 07:00 next morning (14h gap), that is treated as a new shift starting."
        >
          <NumberSlider
            value={local.shiftGapHours}
            onChange={(v) => update("shiftGapHours", v)}
            min={1}
            max={16}
            step={0.5}
            unit="hours"
            lowLabel="1 hour (strict)"
            highLabel="16 hours (loose)"
          />
          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              background: "var(--bg-muted)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            💡 <strong>Recommended:</strong> Set this to roughly half the time
            between your shift end and next shift start. For a 9-to-5 workplace
            that means about 5–6 hours works well.
          </div>
        </SettingCard>

        {/* ── Setting 3: Break tracking ───────────────────────── */}
        <SettingCard
          icon={Coffee}
          iconColor="var(--status-approved-text)"
          iconBg="var(--status-approved-bg)"
          title="Do employees scan when taking breaks?"
          description="If your staff punch out when going for lunch and punch back in when they return, turn this ON. The system will label those short absences as BREAK_OUT and BREAK_IN instead of treating them as shift endings."
          example="Staff leaves for lunch at 12:30 (BREAK_OUT) and returns at 13:15 (BREAK_IN). Without this ON, the system would think they left work at 12:30."
        >
          <Toggle
            value={local.enableBreakTracking}
            onChange={(v) => update("enableBreakTracking", v)}
            onLabel="Yes, staff scan for breaks"
            offLabel="No, only scan start/end of shift"
          />

          <AnimatePresence>
            {local.enableBreakTracking && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden", marginTop: 14 }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-secondary)",
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  Maximum break duration
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 400,
                      color: "var(--text-muted)",
                      marginLeft: 6,
                    }}
                  >
                    (scans closer together than this are treated as a break)
                  </span>
                </div>
                <NumberSlider
                  value={local.breakMaxMinutes}
                  onChange={(v) => update("breakMaxMinutes", v)}
                  min={15}
                  max={240}
                  step={15}
                  unit="minutes"
                  lowLabel="15 min (short breaks only)"
                  highLabel="4 hours (long breaks)"
                />
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    background: "var(--status-approved-bg)",
                    border: "1px solid var(--status-approved-border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12,
                    color: "var(--status-approved-text)",
                  }}
                >
                  💡 Set this to your longest allowed break. If lunch is max 1
                  hour, set 60 minutes.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SettingCard>

        {/* ── Setting 4: Night shift ──────────────────────────── */}
        <SettingCard
          icon={Moon}
          iconColor="var(--brand-500)"
          iconBg="var(--brand-50)"
          title="Do you have night shifts that go past midnight?"
          description="If your employees start work late at night (e.g. 10 PM) and finish in the early hours of the next morning (e.g. 6 AM), turn this ON. The system will group those early-morning scans with the previous night instead of treating them as a new day."
          example="A night shift starts at 22:00 on Monday and ends at 06:00 on Tuesday. With this ON, the Tuesday 06:00 scan is grouped with Monday's shift, not Tuesday's."
        >
          <Toggle
            value={local.nightShiftMode}
            onChange={(v) => update("nightShiftMode", v)}
            onLabel="Yes, we have night shifts crossing midnight"
            offLabel="No, all shifts finish before midnight"
          />
          {local.nightShiftMode && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "var(--status-pending-bg)",
                border: "1px solid var(--status-pending-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                color: "var(--status-pending-text)",
              }}
            >
              ⚠️ Scans between 12:00 AM and 5:59 AM will be grouped with the
              previous day's shift.
            </div>
          )}
        </SettingCard>

        {/* ── Advanced section toggle ─────────────────────────── */}
        <button
          onClick={() => setShowAdvanced((p) => !p)}
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
          }}
        >
          <Settings2 size={14} />
          Advanced Settings
          {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11.5,
              fontWeight: 400,
              color: "var(--text-muted)",
            }}
          >
            For unusual setups — most users don't need these
          </span>
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <SettingCard
                icon={AlertTriangle}
                iconColor="var(--status-rejected-text)"
                iconBg="var(--status-rejected-bg)"
                title="Ignore double-scans (noise filter)"
                description="Sometimes a fingerprint machine records the same person twice within seconds — this is called a 'double tap'. Set a minimum time gap below which duplicate scans are ignored automatically."
                example="If someone's finger scans twice within 30 seconds by accident, only the first scan is kept."
                advanced
              >
                <NumberSlider
                  value={local.minShiftMinutes}
                  onChange={(v) => update("minShiftMinutes", v)}
                  min={0}
                  max={10}
                  step={1}
                  unit="minutes"
                  lowLabel="0 min (keep all scans)"
                  highLabel="10 min (filter close scans)"
                />
              </SettingCard>
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
            marginTop: 4,
          }}
        >
          <button
            onClick={handleReset}
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
  const [logs, setLogs] = useState<Log[]>([]);
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [showType, setShowType] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [fileName, setFileName] = useState("");
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] =
    useState<FingerprintSettings>(DEFAULT_SETTINGS);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load settings on mount
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

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/fingerprint/process", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (!data.logs?.length) throw new Error("No valid records found");
      setLogs(data.logs);
      setCsv(data.csv);
      toast.success(
        `Processed ${data.logs.length} records from ${new Set(data.logs.map((l: Log) => l.empId)).size} employees`,
      );
    } catch (e: any) {
      toast.error(e.message);
      setFileName("");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function handleDownloadCSV() {
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
      l.date.includes(search),
  );

  const inCount = logs.filter((l) => l.type === "IN").length;
  const outCount = logs.filter((l) => l.type === "OUT").length;
  const breakCount = logs.filter((l) => l.type.startsWith("BREAK")).length;
  const uniqueEmps = new Set(logs.map((l) => l.empId)).size;
  const uniqueDates = new Set(logs.map((l) => l.date)).size;
  const withNotes = logs.filter((l) => l.note).length;

  function TypeBadge({ type }: { type: LogType }) {
    const map: Record<LogType, { bg: string; color: string; label: string }> = {
      IN: {
        bg: "var(--status-approved-bg)",
        color: "var(--status-approved-text)",
        label: "IN",
      },
      OUT: {
        bg: "var(--status-rejected-bg)",
        color: "var(--status-rejected-text)",
        label: "OUT",
      },
      BREAK_OUT: {
        bg: "var(--status-pending-bg)",
        color: "var(--status-pending-text)",
        label: "BREAK OUT",
      },
      BREAK_IN: {
        bg: "var(--brand-50)",
        color: "var(--brand-600)",
        label: "BREAK IN",
      },
    };
    const s = map[type];
    return (
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: 99,
          background: s.bg,
          color: s.color,
          whiteSpace: "nowrap",
        }}
      >
        {s.label}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AdminPageHeader
        title="Fingerprint Logs"
        sub="Upload raw TXT logs from fingerprint machines and export clean CSV"
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
                  <HelpCircle size={13} />
                  {showNotes ? "Hide" : "Show"} Notes
                  {withNotes > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: 99,
                        background: "var(--brand-100)",
                        color: "var(--brand-600)",
                      }}
                    >
                      {withNotes}
                    </span>
                  )}
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
                  onClick={handleDownloadCSV}
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

      {/* Upload card */}
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
                  {logs.length} records · {uniqueEmps} employees · {uniqueDates}{" "}
                  dates
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
              Processing logs...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      {logs.length > 0 && !loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {[
            {
              label: "Total Records",
              value: logs.length,
              color: "var(--brand-500)",
            },
            {
              label: "IN Punches",
              value: inCount,
              color: "var(--status-approved-text)",
            },
            {
              label: "OUT Punches",
              value: outCount,
              color: "var(--status-rejected-text)",
            },
            ...(breakCount > 0
              ? [
                  {
                    label: "Break Scans",
                    value: breakCount,
                    color: "var(--status-pending-text)",
                  },
                ]
              : []),
            {
              label: "Employees",
              value: uniqueEmps,
              color: "var(--brand-600)",
            },
            {
              label: "Dates",
              value: uniqueDates,
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
          {/* Table toolbar */}
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
              placeholder="Search by Emp ID or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "5px 10px",
                width: 220,
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
              gridTemplateColumns: [
                "90px",
                "110px",
                "130px",
                "100px",
                ...(showType ? ["110px"] : []),
                ...(showNotes ? ["1fr"] : []),
              ].join(" "),
              padding: "9px 16px",
              borderBottom: "1px solid var(--border-base)",
              background: "var(--bg-muted)",
              gap: 12,
            }}
          >
            {[
              "Emp ID",
              "Shift",
              "Date",
              "Time",
              ...(showType ? ["Type"] : []),
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
                No records match your search
              </div>
            ) : (
              filtered.map((log, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: [
                      "90px",
                      "110px",
                      "130px",
                      "100px",
                      ...(showType ? ["110px"] : []),
                      ...(showNotes ? ["1fr"] : []),
                    ].join(" "),
                    padding: "9px 16px",
                    borderBottom:
                      i < filtered.length - 1
                        ? "1px solid var(--border-base)"
                        : "none",
                    alignItems: "center",
                    gap: 12,
                    transition: "background 0.1s",
                    background: log.note ? "var(--brand-50)" : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--bg-muted)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      log.note ? "var(--brand-50)" : "transparent")
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
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    Shift {log.shiftIndex + 1}
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
                  {showType && <TypeBadge type={log.type} />}
                  {showNotes && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--brand-600)",
                        fontStyle: log.note ? "normal" : "italic",
                      }}
                    >
                      {log.note ?? "—"}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
    </div>
  );
}
