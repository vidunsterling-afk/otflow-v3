import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  sub?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function SectionHeader({
  title,
  sub,
  icon: Icon,
  action,
}: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-sm)",
              background: "var(--brand-50)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={14} color="var(--brand-600)" strokeWidth={2} />
          </div>
        )}
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "-0.2px",
            }}
          >
            {title}
          </div>
          {sub && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {sub}
            </div>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
