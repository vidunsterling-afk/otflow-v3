"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Btn } from "@/components/admin/PrimaryBtn";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { toast } from "sonner";

interface DecisionReason {
  id: string;
  type: string;
  label: string;
  active: boolean;
  sort: number;
}

export default function DecisionReasonsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState("APPROVE");
  const [label, setLabel] = useState("");
  const [sort, setSort] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: reasons = [], isLoading } = useQuery<DecisionReason[]>({
    queryKey: ["admin-decision-reasons"],
    queryFn: () => fetch("/api/admin/decision-reasons").then((r) => r.json()),
  });

  function openAdd() {
    setType("APPROVE");
    setLabel("");
    setSort(0);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!label.trim()) {
      toast.error("Label required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/decision-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label, sort }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Reason added");
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-decision-reasons"] });
      qc.invalidateQueries({ queryKey: ["decision-reasons"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: DecisionReason) {
    await fetch(`/api/admin/decision-reasons/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !r.active }),
    });
    toast.success(`Reason ${r.active ? "disabled" : "enabled"}`);
    qc.invalidateQueries({ queryKey: ["admin-decision-reasons"] });
    qc.invalidateQueries({ queryKey: ["decision-reasons"] });
  }

  async function handleDelete(r: DecisionReason) {
    if (!confirm(`Delete "${r.label}"?`)) return;
    const res = await fetch(`/api/admin/decision-reasons/${r.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-decision-reasons"] });
    } else toast.error("Failed");
  }

  const approveReasons = reasons.filter((r) => r.type === "APPROVE");
  const rejectReasons = reasons.filter((r) => r.type === "REJECT");

  function ReasonGroup({
    title,
    data,
    color,
  }: {
    title: string;
    data: DecisionReason[];
    color: string;
  }) {
    return (
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <AdminTable
          columns={[
            {
              key: "label",
              label: "Label",
              render: (r) => (
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: r.active
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                    textDecoration: r.active ? "none" : "line-through",
                  }}
                >
                  {r.label}
                </span>
              ),
            },
            {
              key: "sort",
              label: "Sort",
              width: "70px",
              render: (r) => (
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {r.sort}
                </span>
              ),
            },
            {
              key: "status",
              label: "Status",
              width: "90px",
              render: (r) => (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: r.active
                      ? "var(--status-approved-bg)"
                      : "var(--bg-muted)",
                    color: r.active
                      ? "var(--status-approved-text)"
                      : "var(--text-muted)",
                  }}
                >
                  {r.active ? "Active" : "Disabled"}
                </span>
              ),
            },
            {
              key: "actions",
              label: "",
              width: "80px",
              render: (r) => (
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => toggleActive(r)}
                    title={r.active ? "Disable" : "Enable"}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: r.active
                        ? "var(--status-rejected-text)"
                        : "var(--status-approved-text)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {r.active ? (
                      <ToggleRight size={16} />
                    ) : (
                      <ToggleLeft size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
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
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ),
            },
          ]}
          data={data}
          keyFn={(r) => r.id}
          loading={isLoading}
          emptyText={`No ${title.toLowerCase()} yet`}
        />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Decision Reasons"
        sub="Labels shown when approving or rejecting OT entries"
        icon={MessageSquare}
        action={
          <Btn icon={Plus} onClick={openAdd}>
            Add Reason
          </Btn>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <ReasonGroup
          title="Approval Reasons"
          data={approveReasons}
          color="var(--status-approved-text)"
        />
        <ReasonGroup
          title="Rejection Reasons"
          data={rejectReasons}
          color="var(--status-rejected-text)"
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Decision Reason"
        width={400}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="APPROVE">Approve</option>
              <option value="REJECT">Reject</option>
            </Select>
          </FormField>
          <FormField label="Label" required>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Project deadline"
            />
          </FormField>
          <FormField label="Sort Order" hint="Lower number = shown first">
            <Input
              type="number"
              value={sort}
              onChange={(e) => setSort(Number(e.target.value))}
            />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Btn>
            <Btn icon={Plus} loading={saving} onClick={handleSave}>
              Add Reason
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
