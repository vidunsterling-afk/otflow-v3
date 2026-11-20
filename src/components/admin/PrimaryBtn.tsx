import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./admin.css";

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
  const iconSize = size === "sm" ? 11 : 13;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className="admin-btn"
      data-variant={variant}
      data-size={size}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        Icon && <Icon size={iconSize} />
      )}
      {children}
    </button>
  );
}
