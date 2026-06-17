import { motion } from "framer-motion";

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

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-base)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-base)",
          background: "var(--bg-muted)",
          gap: 12,
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {loading && (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          Loading...
        </div>
      )}

      {!loading && data.length === 0 && (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          {emptyText}
        </div>
      )}

      {!loading &&
        data.map((row, i) => (
          <motion.div
            key={keyFn(row)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            style={{
              display: "grid",
              gridTemplateColumns: gridCols,
              padding: "11px 16px",
              borderBottom:
                i < data.length - 1 ? "1px solid var(--border-base)" : "none",
              alignItems: "center",
              gap: 12,
              transition: "background 0.1s",
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
            {columns.map((col) => (
              <div key={col.key}>{col.render(row)}</div>
            ))}
          </motion.div>
        ))}
    </div>
  );
}
