import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  sub: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}

export function AdminPageHeader({ title, sub, icon: Icon, action }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: "var(--brand-50)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--brand-100)",
          }}
        >
          <Icon size={18} color="var(--brand-600)" strokeWidth={2} />
        </div>
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.4px",
            }}
          >
            {title}
          </div>
          <div
            style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}
          >
            {sub}
          </div>
        </div>
      </div>
      {action}
    </div>
  );
}
