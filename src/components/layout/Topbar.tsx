"use client";

import { signOut } from "next-auth/react";
import { Bell, LogOut, User } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    username?: string;
    roleName?: string;
  };
}

export function Topbar({ user }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      style={{
        height: 60,
        borderBottom: "1px solid var(--border-base)",
        background: "var(--bg-card)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left — page title placeholder (per-page via slot) */}
      <div
        style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}
      >
        Overtime Management System
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Notification Bell */}
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-base)",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-secondary)",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background =
              "var(--bg-muted)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "transparent")
          }
        >
          <Bell size={15} />
        </button>

        {/* User menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px 6px 6px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-base)",
              background: "transparent",
              cursor: "pointer",
              transition: "background 0.15s",
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
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--brand-100)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={13} color="var(--brand-600)" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  lineHeight: 1.2,
                }}
              >
                {user.username ?? user.name ?? "User"}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text-muted)",
                  lineHeight: 1.2,
                }}
              >
                {user.roleName ?? "—"}
              </div>
            </div>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 49 }}
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    width: 180,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-base)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-dropdown)",
                    zIndex: 50,
                    overflow: "hidden",
                    padding: 4,
                  }}
                >
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--status-rejected-text)",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "var(--status-rejected-bg)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "transparent")
                    }
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
