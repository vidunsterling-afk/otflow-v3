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

const WARN_AT_SECONDS = 5 * 60; // show topbar timer at 5 min
const POPUP_AT_SECONDS = 3 * 60; // show popup at 3 min
const CRITICAL_AT_SECONDS = 60; // red at 1 min

function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getSecondsRemaining(expires: string | undefined): number {
  if (!expires) return Infinity;
  const expMs = new Date(expires).getTime();
  const nowMs = Date.now();
  return Math.max(0, Math.floor((expMs - nowMs) / 1000));
}

export function SessionCountdown() {
  const { data: session, update } = useSession();
  const [secondsLeft, setSecondsLeft] = useState<number>(Infinity);
  const [popupOpen, setPopupOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const popupShownRef = useRef(false);

  // Tick every second
  useEffect(() => {
    if (!session?.expires) return;

    const tick = () => {
      const secs = getSecondsRemaining(session.expires);
      setSecondsLeft(secs);

      // Show popup once when hitting threshold
      if (
        secs <= POPUP_AT_SECONDS &&
        secs > 0 &&
        !popupShownRef.current &&
        !popupDismissed
      ) {
        setPopupOpen(true);
        popupShownRef.current = true;
      }

      // Auto sign out when expired
      if (secs <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        signOut({ callbackUrl: "/login" });
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [session?.expires, popupDismissed]);

  // Reset popup flag when session is extended
  useEffect(() => {
    if (session?.expires) {
      const secs = getSecondsRemaining(session.expires);
      if (secs > POPUP_AT_SECONDS) {
        popupShownRef.current = false;
        setPopupDismissed(false);
        setPopupOpen(false);
      }
    }
  }, [session?.expires]);

  const handleExtend = useCallback(async () => {
    setExtending(true);
    try {
      await update(); // triggers NextAuth to refresh the JWT
      setPopupOpen(false);
      setPopupDismissed(false);
      popupShownRef.current = false;
    } catch {
      // fallback: reload page to refresh session
      window.location.reload();
    } finally {
      setExtending(false);
    }
  }, [update]);

  const handleDismiss = useCallback(() => {
    setPopupOpen(false);
    setPopupDismissed(true);
  }, []);

  // Don't render anything if plenty of time left
  const showTimer = secondsLeft !== Infinity && secondsLeft <= WARN_AT_SECONDS;
  const isCritical = secondsLeft <= CRITICAL_AT_SECONDS;
  const isWarning = secondsLeft <= POPUP_AT_SECONDS;

  return (
    <>
      {/* ── Topbar chip ─────────────────────────────────── */}
      <AnimatePresence>
        {showTimer && (
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
              border: `1px solid ${
                isCritical
                  ? "var(--status-rejected-border)"
                  : isWarning
                    ? "var(--status-pending-border)"
                    : "var(--border-base)"
              }`,
              background: isCritical
                ? "var(--status-rejected-bg)"
                : isWarning
                  ? "var(--status-pending-bg)"
                  : "var(--bg-muted)",
              cursor: "pointer",
              transition: "all 0.2s",
              userSelect: "none",
            }}
          >
            <motion.div
              animate={isCritical ? { scale: [1, 1.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.8 }}
            >
              <Clock
                size={12}
                color={
                  isCritical
                    ? "var(--status-rejected-text)"
                    : isWarning
                      ? "var(--status-pending-text)"
                      : "var(--text-muted)"
                }
              />
            </motion.div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isCritical
                  ? "var(--status-rejected-text)"
                  : isWarning
                    ? "var(--status-pending-text)"
                    : "var(--text-muted)",
                fontFamily: "var(--font-geist-mono)",
                letterSpacing: "0.5px",
              }}
            >
              {formatTime(secondsLeft)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Warning popup ────────────────────────────────── */}
      <AnimatePresence>
        {popupOpen && (
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
                border: `1px solid ${
                  isCritical
                    ? "var(--status-rejected-border)"
                    : "var(--status-pending-border)"
                }`,
                borderRadius: "var(--radius-xl)",
                boxShadow: "var(--shadow-modal)",
                overflow: "hidden",
                pointerEvents: "all",
              }}
            >
              {/* Animated top bar */}
              <motion.div
                initial={{ width: "100%" }}
                animate={{
                  width:
                    secondsLeft <= 0
                      ? "0%"
                      : `${(secondsLeft / POPUP_AT_SECONDS) * 100}%`,
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
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
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
                    onClick={handleDismiss}
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

                {/* Countdown display */}
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
                    border: `1px solid ${
                      isCritical
                        ? "var(--status-rejected-border)"
                        : "var(--status-pending-border)"
                    }`,
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

                {/* Info text */}
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
                    <LogOut size={12} />
                    Sign Out
                  </button>
                  <button
                    onClick={handleExtend}
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

                {/* Session info footer */}
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
    </>
  );
}
