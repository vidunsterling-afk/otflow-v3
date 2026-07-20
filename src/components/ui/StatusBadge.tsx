import { getStatusColor } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

type Props = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  iconOnly?: boolean;
  iconWithText?: boolean;
};

export function StatusBadge({
  status,
  iconOnly = false,
  iconWithText = false,
}: Props) {
  const colors = getStatusColor(status);

  const config = {
    PENDING: Clock,
    APPROVED: CheckCircle2,
    REJECTED: XCircle,
  };

  const pillStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 9999,
    background: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    whiteSpace: "nowrap",
  };

  const Icon = config[status];

  if (iconOnly) {
    return <Icon size={18} color={colors.text} />;
  }

  if (iconWithText) {
    return (
      <span
        style={{
          ...pillStyle,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <Icon size={14} />
        {status}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.2px",
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} />
      {status}
    </span>
  );
}
