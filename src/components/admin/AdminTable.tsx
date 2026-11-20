import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import "./admin.css";

interface Column<T> {
  key: string;
  label: string;
  width?: string | number;
  render: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
}

export function AdminTable<T>({
  columns,
  data,
  keyFn,
  loading,
  emptyText = "No data found",
}: Props<T>) {
  const gridCols = columns.map((c) => c.width ?? "1fr").join(" ");
  const tableStyle = { "--admin-cols": gridCols } as CSSProperties;

  return (
    <div className="admin-table-card">
      <div className="admin-table-scroll">
        <div className="admin-table" style={tableStyle}>
          <div className="admin-table__head">
            {columns.map((col) => (
              <div key={col.key} className="admin-table__head-cell">
                {col.label}
              </div>
            ))}
          </div>

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="admin-skeleton-row">
                {columns.map((col) => (
                  <span key={col.key} className="admin-skeleton" />
                ))}
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="admin-empty">
              <Inbox size={22} color="var(--text-muted)" />
              <div className="admin-empty__title">{emptyText}</div>
            </div>
          ) : (
            data.map((row, i) => (
              <motion.div
                key={keyFn(row)}
                className="admin-table__row"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                {columns.map((col) => (
                  <div key={col.key} className="admin-table__cell">
                    {col.render(row)}
                  </div>
                ))}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
