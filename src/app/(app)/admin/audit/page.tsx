"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/FormField";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  diff?: any;
  meta?: any;
  actor: { username: string; email: string };
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
  entityTypes: string[];
  actors: { id: string; username: string }[];
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  CREATE: {
    bg: "var(--status-approved-bg)",
    text: "var(--status-approved-text)",
  },
  EDIT: { bg: "var(--brand-50)", text: "var(--brand-600)" },
  DELETE: {
    bg: "var(--status-rejected-bg)",
    text: "var(--status-rejected-text)",
  },
  APPROVE: {
    bg: "var(--status-approved-bg)",
    text: "var(--status-approved-text)",
  },
  REJECT: {
    bg: "var(--status-rejected-bg)",
    text: "var(--status-rejected-text)",
  },
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [diffEntry, setDiffEntry] = useState<AuditLog | null>(null);

  const params = new URLSearchParams({
    page: String(page),
    ...(entityType && { entityType }),
    ...(action && { action }),
    ...(actorId && { actorId }),
    ...(from && { from }),
    ...(to && { to }),
  }).toString();

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["audit-logs", params],
    queryFn: () => fetch(`/api/admin/audit?${params}`).then((r) => r.json()),
    placeholderData: (prev) => prev,
  });

  function ActionBadge({ a }: { a: string }) {
    const c = ACTION_COLORS[a] ?? {
      bg: "var(--bg-muted)",
      text: "var(--text-secondary)",
    };
    return (
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: 99,
          background: c.bg,
          color: c.text,
          letterSpacing: "0.3px",
        }}
      >
        {a}
      </span>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Audit Trail"
        sub={`${data?.total ?? 0} total events`}
        icon={Settings}
      />

      {/* Filters */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-base)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 16px",
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "flex-end",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Entity Type
          </div>
          <Select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            style={{ width: 150 }}
          >
            <option value="">All Types</option>
            {data?.entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Action
          </div>
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            style={{ width: 130 }}
          >
            <option value="">All Actions</option>
            {["CREATE", "EDIT", "DELETE", "APPROVE", "REJECT"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Actor
          </div>
          <Select
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(1);
            }}
            style={{ width: 150 }}
          >
            <option value="">All Users</option>
            {data?.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.username}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            From
          </div>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            style={{ width: 150 }}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            To
          </div>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            style={{ width: 150 }}
          />
        </div>
        {(entityType || action || actorId || from || to) && (
          <button
            onClick={() => {
              setEntityType("");
              setAction("");
              setActorId("");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            style={{
              padding: "7px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-base)",
              background: "transparent",
              fontSize: 12.5,
              color: "var(--text-secondary)",
              cursor: "pointer",
              alignSelf: "flex-end",
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
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
            gridTemplateColumns: "160px 120px 100px 1fr 140px 40px",
            padding: "10px 16px",
            gap: 12,
            borderBottom: "1px solid var(--border-base)",
            background: "var(--bg-muted)",
          }}
        >
          {["Timestamp", "Entity", "Action", "Actor", "Entity ID", ""].map(
            (h) => (
              <div
                key={h}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {h}
              </div>
            ),
          )}
        </div>

        {isLoading && (
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
        {!isLoading && data?.logs.length === 0 && (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No audit events found
          </div>
        )}

        {!isLoading &&
          data?.logs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 120px 100px 1fr 140px 40px",
                padding: "11px 16px",
                gap: 12,
                borderBottom:
                  i < data.logs.length - 1
                    ? "1px solid var(--border-base)"
                    : "none",
                alignItems: "center",
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
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                {format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss")}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--brand-600)",
                  background: "var(--brand-50)",
                  padding: "2px 8px",
                  borderRadius: 99,
                  display: "inline-block",
                  width: "fit-content",
                }}
              >
                {log.entityType}
              </div>
              <ActionBadge a={log.action} />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {log.actor.username}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {log.actor.email}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-geist-mono)",
                  wordBreak: "break-all",
                }}
              >
                {log.entityId.slice(0, 20)}…
              </div>
              {log.diff ? (
                <button
                  onClick={() => setDiffEntry(log)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-base)",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                  <Eye size={12} />
                </button>
              ) : (
                <div />
              )}
            </motion.div>
          ))}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            marginTop: 12,
            background: "var(--bg-card)",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Page {page} of {data.totalPages} · {data.total} events
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-base)",
                background: "var(--bg-card)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: page === 1 ? "not-allowed" : "pointer",
                opacity: page === 1 ? 0.4 : 1,
                color: "var(--text-secondary)",
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-base)",
                background: "var(--bg-card)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: page === data.totalPages ? "not-allowed" : "pointer",
                opacity: page === data.totalPages ? 0.4 : 1,
                color: "var(--text-secondary)",
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Diff viewer modal */}
      <Modal
        open={!!diffEntry}
        onClose={() => setDiffEntry(null)}
        title="Change Details"
        subtitle={`${diffEntry?.entityType} · ${diffEntry?.action}`}
        width={600}
      >
        {diffEntry?.diff && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {diffEntry.diff.before && (
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--status-rejected-text)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Before
                </div>
                <pre
                  style={{
                    fontSize: 11.5,
                    background: "var(--status-rejected-bg)",
                    border: "1px solid var(--status-rejected-border)",
                    borderRadius: "var(--radius-md)",
                    padding: 12,
                    overflowX: "auto",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-geist-mono)",
                    lineHeight: 1.6,
                  }}
                >
                  {JSON.stringify(diffEntry.diff.before, null, 2)}
                </pre>
              </div>
            )}
            {diffEntry.diff.after && (
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--status-approved-text)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  After
                </div>
                <pre
                  style={{
                    fontSize: 11.5,
                    background: "var(--status-approved-bg)",
                    border: "1px solid var(--status-approved-border)",
                    borderRadius: "var(--radius-md)",
                    padding: 12,
                    overflowX: "auto",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-geist-mono)",
                    lineHeight: 1.6,
                  }}
                >
                  {JSON.stringify(diffEntry.diff.after, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
