"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Pencil } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Btn } from "@/components/admin/PrimaryBtn";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input } from "@/components/ui/FormField";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface TripleDay {
  id: string;
  date: string;
  note?: string | null;
  createdAt: string;
}

export default function TripleDaysPage() {
  const qc = useQueryClient();
  const year = new Date().getFullYear().toString();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TripleDay | null>(null);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: days = [], isLoading } = useQuery<TripleDay[]>({
    queryKey: ["triple-days"],
    queryFn: () =>
      fetch(`/api/admin/triple-days?year=${year}`).then((r) => r.json()),
  });

  function openAdd() {
    setEditTarget(null);
    setDate("");
    setNote("");
    setModalOpen(true);
  }
  function openEdit(d: TripleDay) {
    setEditTarget(d);
    setDate(d.date);
    setNote(d.note ?? "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!date) {
      toast.error("Date required");
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        const res = await fetch(`/api/admin/triple-days/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Triple day updated");
      } else {
        const res = await fetch("/api/admin/triple-days", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, note }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Triple day added");
      }
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ["triple-days"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: TripleDay) {
    if (!confirm(`Remove ${d.date} as a triple day?`)) return;
    const res = await fetch(`/api/admin/triple-days/${d.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Triple day removed");
      qc.invalidateQueries({ queryKey: ["triple-days"] });
    } else toast.error("Failed");
  }

  return (
    <div>
      <AdminPageHeader
        title="Triple OT Days"
        sub={`${days.length} dates marked as triple OT for ${year}`}
        icon={CalendarDays}
        action={
          <Btn icon={Plus} onClick={openAdd}>
            Add Triple Day
          </Btn>
        }
      />

      <div
        style={{
          padding: "12px 16px",
          marginBottom: 16,
          background: "var(--status-pending-bg)",
          border: "1px solid var(--status-pending-border)",
          borderRadius: "var(--radius-md)",
          fontSize: 12.5,
          color: "var(--status-pending-text)",
        }}
      >
        Dates added here will have all OT calculated as{" "}
        <strong>Triple rate</strong>, overriding the normal day/shift rules.
        This is used for special holidays or company-declared triple OT days.
      </div>

      <AdminTable
        columns={[
          {
            key: "date",
            label: "Date",
            width: "160px",
            render: (d) => (
              <div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {d.date}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {formatDate(d.date)}
                </div>
              </div>
            ),
          },
          {
            key: "day",
            label: "Day",
            width: "120px",
            render: (d) => {
              const day = new Date(d.date + "T00:00:00Z").toLocaleDateString(
                "en-US",
                { weekday: "long", timeZone: "UTC" },
              );
              const isSun = day === "Sunday";
              return (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: isSun
                      ? "var(--status-rejected-bg)"
                      : "var(--brand-50)",
                    color: isSun
                      ? "var(--status-rejected-text)"
                      : "var(--brand-600)",
                  }}
                >
                  {day}
                </span>
              );
            },
          },
          {
            key: "note",
            label: "Note",
            render: (d) => (
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                {d.note || "—"}
              </span>
            ),
          },
          {
            key: "actions",
            label: "",
            width: "80px",
            render: (d) => (
              <div
                style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}
              >
                <button
                  onClick={() => openEdit(d)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--brand-500)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--brand-50)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(d)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--status-rejected-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--status-rejected-bg)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ),
          },
        ]}
        data={days}
        keyFn={(d) => d.id}
        loading={isLoading}
        emptyText="No triple OT days defined"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Triple Day" : "Add Triple Day"}
        width={400}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Date" required>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!!editTarget}
            />
          </FormField>
          <FormField
            label="Note"
            hint="Optional — e.g. 'National Holiday', 'Company declared'"
          >
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. National Holiday"
            />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Btn>
            <Btn
              icon={editTarget ? Pencil : Plus}
              loading={saving}
              onClick={handleSave}
            >
              {editTarget ? "Save" : "Add Triple Day"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
