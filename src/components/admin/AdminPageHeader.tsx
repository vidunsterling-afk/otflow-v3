import type { LucideIcon } from "lucide-react";
import "./admin.css";

interface Props {
  title: string;
  sub: string;
  icon: LucideIcon;
  eyebrow?: string;
  action?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  sub,
  icon: Icon,
  eyebrow,
  action,
}: Props) {
  return (
    <div className="admin-head">
      <div className="admin-head__main">
        <span className="admin-head__icon">
          <Icon size={18} strokeWidth={2} />
        </span>
        <div>
          {eyebrow && <div className="admin-head__eyebrow">{eyebrow}</div>}
          <div className="admin-head__title">{title}</div>
          <div className="admin-head__sub">{sub}</div>
        </div>
      </div>
      {action && <div className="admin-head__actions">{action}</div>}
    </div>
  );
}
