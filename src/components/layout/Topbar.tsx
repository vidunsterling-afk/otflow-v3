"use client";

import { signOut } from "next-auth/react";
import { Menu, UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SessionCountdown } from "@/components/layout/SessionCountdown";
import { useSidebarStore } from "@/lib/sidebar-store";
// import { NotificationBell } from "@/components/layout/NotificationBell";
import { TimePill } from "../ui/time-pill";
import { AnimateIcon } from "../animate-ui/icons/icon";
import { LogOutIcon } from "../animate-ui/icons/log-out";

interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    username?: string;
    roleName?: string;
  };
}

// Single easing curve used everywhere so nothing feels out of sync
const EASE = [0.22, 1, 0.36, 1] as const; // easeOutExpo-ish — smooth, no overshoot
const LAYOUT_TRANSITION = { duration: 0.28, ease: EASE };
const CONTENT_TRANSITION = { duration: 0.16, ease: EASE };

export function Topbar({ user }: TopbarProps) {
  const [confirming, setConfirming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleMobile = useSidebarStore((state) => state.toggleMobile);

  const clearResetTimer = () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  };

  const armResetTimer = () => {
    clearResetTimer();
    resetTimer.current = setTimeout(() => setConfirming(false), 3000);
  };

  useEffect(() => {
    if (!confirming) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-signout-trigger]")) {
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [confirming]);

  useEffect(() => clearResetTimer, []);

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      armResetTimer();
      return;
    }
    clearResetTimer();
    signOut({ callbackUrl: "/login" });
  };

  return (
    <header
      style={{
        height: 68,
        borderBottom: "1px solid var(--border-base)",
        background: "var(--bg-card)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left — mobile menu + time */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          className="sidebar-hamburger"
          onClick={toggleMobile}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
        <TimePill />
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <SessionCountdown />
        {/* <NotificationBell /> */}

        {/* User menu — morphs in place, height is fixed so the topbar never shifts */}
        <motion.button
          layout="preserve-aspect"
          data-signout-trigger
          onClick={handleClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          animate={{
            backgroundColor: confirming
              ? "var(--status-rejected-bg)"
              : hovered
                ? "var(--bg-muted)"
                : "rgba(0,0,0,0)",
            borderColor: confirming
              ? "var(--status-rejected-text)"
              : "var(--border-base)",
          }}
          transition={{
            layout: LAYOUT_TRANSITION,
            backgroundColor: CONTENT_TRANSITION,
            borderColor: CONTENT_TRANSITION,
          }}
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px 0 8px",
            borderRadius: "var(--radius-md)",
            borderWidth: 1,
            borderStyle: "solid",
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          {/* Avatar — fixed size, only the icon inside crossfades */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              flexShrink: 0,
              background: confirming
                ? "var(--status-rejected-bg)"
                : "var(--brand-100)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {confirming ? (
                <motion.span
                  key="logout-icon"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={CONTENT_TRANSITION}
                  style={{ display: "flex" }}
                >
                  <AnimateIcon animate={hovered}>
                    <LogOutIcon size={15} color="var(--status-rejected-text)" />
                  </AnimateIcon>
                </motion.span>
              ) : (
                <motion.span
                  key="user-icon"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={CONTENT_TRANSITION}
                  style={{ display: "flex" }}
                >
                  <UserIcon size={15} color="var(--brand-600)" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Text block — fixed line-height/font-size in both states, so no height jump */}
          <div style={{ textAlign: "left", position: "relative" }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {confirming ? (
                <motion.div
                  key="confirm-text"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={CONTENT_TRANSITION}
                  style={{ whiteSpace: "nowrap" }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--status-rejected-text)",
                      lineHeight: 1.25,
                    }}
                  >
                    Click to sign out
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--status-rejected-text)",
                      opacity: 0.75,
                      lineHeight: 1.25,
                    }}
                  >
                    Tap again to confirm
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="user-text"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={CONTENT_TRANSITION}
                  style={{ whiteSpace: "nowrap" }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      lineHeight: 1.25,
                    }}
                  >
                    {user.username ?? user.name ?? "User"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      lineHeight: 1.25,
                    }}
                  >
                    {user.roleName ?? "—"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.button>
      </div>
    </header>
  );
}
