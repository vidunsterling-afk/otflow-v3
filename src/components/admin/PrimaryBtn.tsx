import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: "primary" | "danger" | "ghost";
  size?: "sm" | "md";
  type?: "button" | "submit";
}

export function Btn({
  onClick,
  loading,
  disabled,
  icon: Icon,
  children,
  variant = "primary",
  size = "md",
  type = "button",
}: Props) {
  const bg =
    variant === "primary"
      ? "var(--brand-500)"
      : variant === "danger"
        ? "var(--status-rejected-text)"
        : "transparent";
  const color = variant === "ghost" ? "var(--text-secondary)" : "white";
  const border = variant === "ghost" ? "1px solid var(--border-base)" : "none";
  const pad = size === "sm" ? "5px 12px" : "8px 16px";
  const fontSize = size === "sm" ? 12.5 : 13;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        borderRadius: "var(--radius-md)",
        border,
        background: loading || disabled ? "var(--bg-muted)" : bg,
        color: loading || disabled ? "var(--text-muted)" : color,
        fontSize,
        fontWeight: 600,
        cursor: loading || disabled ? "not-allowed" : "pointer",
        transition: "opacity 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 11 : 13} className="animate-spin" />
      ) : (
        Icon && <Icon size={size === "sm" ? 11 : 13} />
      )}
      {children}
    </button>
  );
}
