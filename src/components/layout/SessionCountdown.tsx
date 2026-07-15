/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  AlertTriangle,
  RefreshCw,
  LogOut,
  X,
  Shield,
} from "lucide-react";

// ── Thresholds ────────────────────────────────────────────────────────────────
const WARN_AT_SECONDS = 5 * 60; // topbar chip appears
const POPUP_AT_SECONDS = 3 * 60; // popup appears
const CRITICAL_AT_SECONDS = 60; // everything goes red

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  if (seconds === Infinity) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatVerbose(seconds: number): string {
  if (seconds === Infinity || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m remaining`;
  if (m > 0) return `${m}m remaining`;
  return `${seconds}s remaining`;
}

function getSecondsRemaining(expires: string | undefined): number {
  if (!expires) return Infinity;
  return Math.max(
    0,
    Math.floor((new Date(expires).getTime() - Date.now()) / 1000),
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────
type SessionStatus = "healthy" | "warning" | "critical";

function getStatus(seconds: number): SessionStatus {
  if (seconds <= CRITICAL_AT_SECONDS) return "critical";
  if (seconds <= WARN_AT_SECONDS) return "warning";
  return "healthy";
}

const STATUS_COLORS: Record<
  SessionStatus,
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
  }
> = {
  healthy: {
    bg: "var(--status-approved-bg)",
    border: "var(--status-approved-border)",
    text: "var(--status-approved-text)",
    dot: "var(--status-approved-text)",
  },
  warning: {
    bg: "var(--status-pending-bg)",
    border: "var(--status-pending-border)",
    text: "var(--status-pending-text)",
    dot: "var(--status-pending-text)",
  },
  critical: {
    bg: "var(--status-rejected-bg)",
    border: "var(--status-rejected-border)",
    text: "var(--status-rejected-text)",
    dot: "var(--status-rejected-text)",
  },
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  healthy: "Active",
  warning: "Expiring Soon",
  critical: "Critical",
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface SessionCountdownProps {
  /**
   * Default (no prop): topbar chip — only appears when ≤ 5 min remaining.
   *
   * alwaysShow: full card widget — visible at all times, shows verbose label,
   *   status badge, and inline Extend button. Drop anywhere on a page.
   *   <SessionCountdown alwaysShow />
   *
   * pill: compact colored pill — always visible, color changes with status,
   *   shows time remaining. Click opens the warning popup.
   *   <SessionCountdown pill />
   */
  alwaysShow?: boolean;
  pill?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SessionCountdown({
  alwaysShow = false,
  pill = false,
}: SessionCountdownProps) {
  const { data: session, update } = useSession();
  const [secondsLeft, setSecondsLeft] = useState<number>(Infinity);
  const [popupOpen, setPopupOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const popupShownRef = useRef(false);

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.expires) return;

    const tick = () => {
      const secs = getSecondsRemaining(session.expires);
      setSecondsLeft(secs);

      if (
        secs <= POPUP_AT_SECONDS &&
        secs > 0 &&
        !popupShownRef.current &&
        !popupDismissed
      ) {
        setPopupOpen(true);
        popupShownRef.current = true;
      }

      if (secs <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        signOut({ callbackUrl: "/login" });
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.expires, popupDismissed]);

  // Reset popup when session is extended
  useEffect(() => {
    if (
      session?.expires &&
      getSecondsRemaining(session.expires) > POPUP_AT_SECONDS
    ) {
      popupShownRef.current = false;
      setPopupDismissed(false);
      setPopupOpen(false);
    }
  }, [session?.expires]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleExtend = useCallback(async () => {
    setExtending(true);
    try {
      await update();
      setPopupOpen(false);
      setPopupDismissed(false);
      popupShownRef.current = false;
    } catch {
      window.location.reload();
    } finally {
      setExtending(false);
    }
  }, [update]);

  const handleDismiss = useCallback(() => {
    setPopupOpen(false);
    setPopupDismissed(true);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const status = getStatus(secondsLeft);
  const colors = STATUS_COLORS[status];
  const isCritical = status === "critical";
  const isWarning = status === "warning";

  // Normal topbar mode: only show when close to expiry
  const showTopbarChip = !alwaysShow && !pill && secondsLeft <= WARN_AT_SECONDS;

  // ── Pill variant ──────────────────────────────────────────────────────────
  if (pill) {
    return (
      <>
        <motion.div
          onClick={() => setPopupOpen(true)}
          title={`Session ${STATUS_LABELS[status]} — ${formatVerbose(secondsLeft)}`}
          animate={isCritical ? { scale: [1, 1.03, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.2 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 99,
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            cursor: "pointer",
            userSelect: "none",
            transition: "all 0.25s",
            whiteSpace: "nowrap",
          }}
        >
          {/* Animated status dot */}
          <motion.div
            animate={
              isCritical
                ? { opacity: [1, 0.2, 1] }
                : isWarning
                  ? { opacity: [1, 0.4, 1] }
                  : {}
            }
            transition={{ repeat: Infinity, duration: isCritical ? 0.7 : 1.4 }}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: colors.dot,
              flexShrink: 0,
            }}
          />

          {/* Time */}
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: colors.text,
              fontFamily: "var(--font-geist-mono)",
              letterSpacing: "0.3px",
            }}
          >
            {secondsLeft === Infinity ? "Active" : formatTime(secondsLeft)}
          </span>

          {/* Status label — only shown when not healthy to save space */}
          {status !== "healthy" && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: colors.text,
                opacity: 0.8,
                letterSpacing: "0.2px",
              }}
            >
              {STATUS_LABELS[status]}
            </span>
          )}
        </motion.div>

        {/* Popup still fires for pill mode */}
        <SessionPopup
          open={popupOpen}
          secondsLeft={secondsLeft}
          isCritical={isCritical}
          extending={extending}
          session={session}
          onDismiss={handleDismiss}
          onExtend={handleExtend}
        />
      </>
    );
  }

  // ── alwaysShow card variant ───────────────────────────────────────────────
  if (alwaysShow) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "14px 20px",
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            cursor: "pointer",
            userSelect: "none",
            transition: "all 0.25s",
            minWidth: 160,
          }}
          onClick={() => setPopupOpen(true)}
        >
          {/* Icon + time row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.div
              animate={isCritical ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.8 }}
            >
              <Clock size={15} color={colors.text} />
            </motion.div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: colors.text,
                fontFamily: "var(--font-geist-mono)",
                letterSpacing: "-0.5px",
              }}
            >
              {formatTime(secondsLeft)}
            </span>
          </div>

          {/* Verbose label */}
          <span style={{ fontSize: 11.5, color: colors.text, opacity: 0.75 }}>
            {secondsLeft === Infinity
              ? "Session active"
              : formatVerbose(secondsLeft)}
          </span>

          {/* Status badge */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 99,
              background: "white",
              color: colors.text,
              border: `1px solid ${colors.border}`,
              letterSpacing: "0.3px",
              textTransform: "uppercase",
            }}
          >
            {STATUS_LABELS[status]}
          </span>

          {/* Inline extend button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExtend();
            }}
            disabled={extending}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 14px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: extending ? "rgba(0,0,0,0.08)" : "var(--brand-500)",
              color: extending ? colors.text : "white",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: extending ? "not-allowed" : "pointer",
              transition: "background 0.15s",
              marginTop: 2,
            }}
          >
            <motion.div
              animate={extending ? { rotate: 360 } : {}}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            >
              <RefreshCw size={11} />
            </motion.div>
            {extending ? "Extending..." : "Extend Session"}
          </button>
        </motion.div>

        <SessionPopup
          open={popupOpen}
          secondsLeft={secondsLeft}
          isCritical={isCritical}
          extending={extending}
          session={session}
          onDismiss={handleDismiss}
          onExtend={handleExtend}
        />
      </>
    );
  }

  // ── Default topbar chip variant ───────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {showTopbarChip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={() => setPopupOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${colors.border}`,
              background: colors.bg,
              cursor: "pointer",
              transition: "all 0.2s",
              userSelect: "none",
            }}
          >
            <motion.div
              animate={isCritical ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.8 }}
            >
              <Clock size={12} color={colors.text} />
            </motion.div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: colors.text,
                fontFamily: "var(--font-geist-mono)",
                letterSpacing: "0.5px",
              }}
            >
              {formatTime(secondsLeft)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <SessionPopup
        open={popupOpen}
        secondsLeft={secondsLeft}
        isCritical={isCritical}
        extending={extending}
        session={session}
        onDismiss={handleDismiss}
        onExtend={handleExtend}
      />
    </>
  );
}

// ── Shared popup extracted so all three variants reuse it ─────────────────────
function SessionPopup({
  open,
  secondsLeft,
  isCritical,
  extending,
  session,
  onDismiss,
  onExtend,
}: {
  open: boolean;
  secondsLeft: number;
  isCritical: boolean;
  extending: boolean;
  session: any;
  onDismiss: () => void;
  onExtend: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: 20,
            pointerEvents: "none",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              width: 340,
              background: "var(--bg-card)",
              border: `1px solid ${isCritical ? "var(--status-rejected-border)" : "var(--status-pending-border)"}`,
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-modal)",
              overflow: "hidden",
              pointerEvents: "all",
            }}
          >
            {/* Draining bar */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{
                width:
                  secondsLeft <= 0
                    ? "0%"
                    : `${Math.min((secondsLeft / POPUP_AT_SECONDS) * 100, 100)}%`,
              }}
              transition={{ duration: 1, ease: "linear" }}
              style={{
                height: 3,
                background: isCritical
                  ? "var(--status-rejected-text)"
                  : "var(--status-pending-text)",
                transformOrigin: "left",
              }}
            />

            <div style={{ padding: "16px 18px" }}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-md)",
                      background: isCritical
                        ? "var(--status-rejected-bg)"
                        : "var(--status-pending-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <motion.div
                      animate={{
                        rotate: isCritical ? [0, -10, 10, -10, 10, 0] : 0,
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        repeatDelay: 1,
                      }}
                    >
                      <AlertTriangle
                        size={17}
                        color={
                          isCritical
                            ? "var(--status-rejected-text)"
                            : "var(--status-pending-text)"
                        }
                      />
                    </motion.div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        letterSpacing: "-0.2px",
                      }}
                    >
                      Session Expiring Soon
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--text-muted)",
                        marginTop: 1,
                      }}
                    >
                      You will be signed out automatically
                    </div>
                  </div>
                </div>
                <button
                  onClick={onDismiss}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-base)",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  <X size={11} />
                </button>
              </div>

              {/* Big countdown */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "14px 0",
                  marginBottom: 14,
                  background: isCritical
                    ? "var(--status-rejected-bg)"
                    : "var(--status-pending-bg)",
                  border: `1px solid ${isCritical ? "var(--status-rejected-border)" : "var(--status-pending-border)"}`,
                  borderRadius: "var(--radius-md)",
                }}
              >
                <motion.span
                  key={Math.floor(secondsLeft)}
                  animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.3 }}
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    color: isCritical
                      ? "var(--status-rejected-text)"
                      : "var(--status-pending-text)",
                    fontFamily: "var(--font-geist-mono)",
                  }}
                >
                  {formatTime(secondsLeft)}
                </motion.span>
              </div>

              {/* Message */}
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  marginBottom: 14,
                  textAlign: "center",
                }}
              >
                {isCritical
                  ? "Sign in again immediately to avoid losing unsaved work."
                  : "Extend your session to keep working without interruption."}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 0",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-base)",
                    background: "transparent",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={12} /> Sign Out
                </button>
                <button
                  onClick={onExtend}
                  disabled={extending}
                  style={{
                    flex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 0",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    background: extending
                      ? "var(--brand-300)"
                      : isCritical
                        ? "var(--status-rejected-text)"
                        : "var(--brand-500)",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "white",
                    cursor: extending ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  <motion.div
                    animate={extending ? { rotate: 360 } : {}}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      ease: "linear",
                    }}
                  >
                    <RefreshCw size={12} />
                  </motion.div>
                  {extending ? "Extending..." : "Extend Session"}
                </button>
              </div>

              {/* Footer */}
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border-base)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <Shield size={10} color="var(--text-muted)" />
                <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                  Session expires at{" "}
                  {session?.expires
                    ? new Date(session.expires).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
