/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Clock,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  entityId?: string;
}

interface NotifResponse {
  notifications: Notification[];
  unreadCount: number;
}

// Small toast that appears bottom-left for new notifications
function NotifToast({
  notif,
  onClose,
}: {
  notif: Notification;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const icon =
    notif.type === "OT_APPROVED" ? (
      <CheckCircle2 size={14} color="var(--status-approved-text)" />
    ) : notif.type === "OT_REJECTED" ? (
      <XCircle size={14} color="var(--status-rejected-text)" />
    ) : (
      <Clock size={14} color="var(--status-pending-text)" />
    );

  const borderColor =
    notif.type === "OT_APPROVED"
      ? "var(--status-approved-border)"
      : notif.type === "OT_REJECTED"
        ? "var(--status-rejected-border)"
        : "var(--status-pending-border)";

  const bgColor =
    notif.type === "OT_APPROVED"
      ? "var(--status-approved-bg)"
      : notif.type === "OT_REJECTED"
        ? "var(--status-rejected-bg)"
        : "var(--status-pending-bg)";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        background: "var(--bg-card)",
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-dropdown)",
        maxWidth: 300,
        position: "relative",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "var(--radius-sm)",
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 2,
          }}
        >
          {notif.title}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-secondary)",
            lineHeight: 1.4,
          }}
        >
          {notif.message}
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          padding: 0,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        <X size={11} />
      </button>
    </motion.div>
  );
}

export function NotificationBell() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const { play } = useNotificationSound();
  const seenIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const { data } = useQuery<NotifResponse>({
    queryKey: ["notifications", userId],
    queryFn: () => fetch("/api/notifications").then((r) => r.json()),
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  // Mark initial notifications as seen so they don't toast on first load
  useEffect(() => {
    if (data?.notifications && isFirstLoad.current) {
      data.notifications.forEach((n) => seenIds.current.add(n.id));
      isFirstLoad.current = false;
    }
  }, [data]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Notification",
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as Notification;

          // Skip if already seen (first load)
          if (seenIds.current.has(notif.id)) return;
          seenIds.current.add(notif.id);

          // Play sound
          const soundType =
            notif.type === "OT_APPROVED"
              ? "success"
              : notif.type === "OT_REJECTED"
                ? "warning"
                : "info";
          play(soundType);

          // Show toast
          setToasts((prev) => [...prev, notif]);

          // Refresh notifications query
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, play, qc]);

  const handleMarkAllRead = useCallback(async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }, [qc, userId]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
    },
    [qc, userId],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const unread = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  function NotifIcon({ type }: { type: string }) {
    if (type === "OT_APPROVED")
      return <CheckCircle2 size={13} color="var(--status-approved-text)" />;
    if (type === "OT_REJECTED")
      return <XCircle size={13} color="var(--status-rejected-text)" />;
    return <Clock size={13} color="var(--status-pending-text)" />;
  }

  function notifBg(type: string) {
    if (type === "OT_APPROVED") return "var(--status-approved-bg)";
    if (type === "OT_REJECTED") return "var(--status-rejected-bg)";
    return "var(--status-pending-bg)";
  }

  return (
    <>
      {/* ── Toast stack (bottom-left) ──────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          zIndex: 300,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <div key={t.id} style={{ pointerEvents: "all" }}>
              <NotifToast notif={t} onClose={() => removeToast(t.id)} />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Bell button ───────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((p) => !p)}
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-base)",
            background: open ? "var(--bg-muted)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-secondary)",
            transition: "background 0.15s",
            position: "relative",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background =
              "var(--bg-muted)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = open
              ? "var(--bg-muted)"
              : "transparent")
          }
        >
          <motion.div
            animate={unread > 0 ? { rotate: [0, -8, 8, -8, 8, 0] } : {}}
            transition={{ repeat: Infinity, repeatDelay: 4, duration: 0.5 }}
          >
            <Bell size={15} />
          </motion.div>

          {/* Unread badge */}
          <AnimatePresence>
            {unread > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "var(--status-rejected-text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 800,
                  color: "white",
                  border: "2px solid var(--bg-card)",
                }}
              >
                {unread > 9 ? "9+" : unread}
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* ── Dropdown ─────────────────────────────────────── */}
        <AnimatePresence>
          {open && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 49 }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 340,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-base)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-dropdown)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border-base)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Bell size={13} color="var(--text-secondary)" />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      Notifications
                    </span>
                    {unread > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 99,
                          background: "var(--status-rejected-text)",
                          color: "white",
                        }}
                      >
                        {unread}
                      </span>
                    )}
                  </div>
                  {unread > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11.5,
                        color: "var(--brand-500)",
                        fontWeight: 500,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div
                      style={{
                        padding: "32px 0",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        color: "var(--text-muted)",
                        fontSize: 13,
                        textAlign: "center",
                      }}
                    >
                      <Bell
                        size={24}
                        style={{
                          opacity: 0.2,
                        }}
                      />
                      <div>No notifications</div>
                    </div>
                  ) : (
                    notifications.map((n, i) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => !n.read && handleMarkRead(n.id)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "11px 14px",
                          borderBottom:
                            i < notifications.length - 1
                              ? "1px solid var(--border-base)"
                              : "none",
                          background: n.read
                            ? "transparent"
                            : "var(--brand-50)",
                          cursor: n.read ? "default" : "pointer",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          if (!n.read)
                            (e.currentTarget as HTMLElement).style.background =
                              "var(--brand-100)";
                        }}
                        onMouseLeave={(e) => {
                          if (!n.read)
                            (e.currentTarget as HTMLElement).style.background =
                              "var(--brand-50)";
                        }}
                      >
                        {/* Unread dot */}
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: n.read
                              ? "transparent"
                              : "var(--brand-500)",
                            marginTop: 5,
                            flexShrink: 0,
                          }}
                        />

                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "var(--radius-sm)",
                            background: notifBg(n.type),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <NotifIcon type={n.type} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: n.read ? 500 : 700,
                              color: "var(--text-primary)",
                              marginBottom: 2,
                            }}
                          >
                            {n.title}
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: "var(--text-secondary)",
                              lineHeight: 1.4,
                              marginBottom: 4,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {n.message}
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: "var(--text-muted)",
                            }}
                          >
                            {formatDistanceToNow(new Date(n.createdAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div
                    style={{
                      padding: "9px 14px",
                      borderTop: "1px solid var(--border-base)",
                      background: "var(--bg-muted)",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    Notifications auto-clear after 24 hours
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
