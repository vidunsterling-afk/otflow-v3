"use client";

import { Menu } from "lucide-react";
import { useSidebarStore } from "@/lib/sidebar-store";
import { SessionCountdown } from "@/components/layout/SessionCountdown";
import { TimePill } from "../ui/time-pill";

export function Topbar() {
  const toggleMobile = useSidebarStore((state) => state.toggleMobile);

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
        <SessionCountdown/>
      </div>
    </header>
  );
}
