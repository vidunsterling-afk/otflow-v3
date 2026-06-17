"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil, Trash2, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Btn } from "@/components/admin/PrimaryBtn";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input } from "@/components/ui/FormField";
import { toast } from "sonner";
import { format } from "date-fns";

interface Employee {
  id: string;
  empId: string;
  name: string;
  addedDate: string;
  createdAt: string;
}

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [empId, setEmpId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading } = useQuery<{
    employees: Employee[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ["admin-employees", q, page],
    queryFn: () =>
      fetch(
        `/api/admin/employees?q=${encodeURIComponent(q)}&page=${page}`,
      ).then((r) => r.json()),
  });

  function handleSearch(v: string) {
    setQ(v);
    setPage(1);
  }

  function openAdd() {
    setEmpId("");
    setName("");
    setAddOpen(true);
  }
  function openEdit(emp: Employee) {
    setEditTarget(emp);
    setName(emp.name);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const res = await fetch(`/api/admin/employees/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
        toast.success("Employee updated");
        setEditTarget(null);
      } else {
        const res = await fetch("/api/admin/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empId, name }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
        toast.success("Employee added");
        setAddOpen(false);
      }
      qc.invalidateQueries({ queryKey: ["admin-employees"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/employees/${emp.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Employee deleted");
      qc.invalidateQueries({ queryKey: ["admin-employees"] });
    } else toast.error("Failed to delete");
  }

  return (
    <div>
      <AdminPageHeader
        title="Employees"
        sub={`${data?.total ?? 0} total employees`}
        icon={Users}
        action={
          <Btn icon={Plus} onClick={openAdd}>
            Add Employee
          </Btn>
        }
      />

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16, maxWidth: 320 }}>
        <Search
          size={13}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        />
        <input
          placeholder="Search by name or ID..."
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: "100%",
            paddingLeft: 30,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "var(--text-primary)",
            background: "var(--bg-card)",
            outline: "none",
          }}
        />
      </div>

      <AdminTable
        columns={[
          {
            key: "empId",
            label: "Emp ID",
            width: "100px",
            render: (r) => (
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 12,
                  color: "var(--brand-600)",
                  background: "var(--brand-50)",
                  padding: "2px 8px",
                  borderRadius: 99,
                }}
              >
                {r.empId}
              </span>
            ),
          },
          {
            key: "name",
            label: "Name",
            render: (r) => (
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {r.name}
              </span>
            ),
          },
          {
            key: "addedDate",
            label: "Added Date",
            width: "160px",
            render: (r) => (
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {format(new Date(r.createdAt), "dd MMM yyyy")}
              </span>
            ),
          },
          {
            key: "actions",
            label: "",
            width: "80px",
            render: (r) => (
              <div
                style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}
              >
                <button
                  onClick={() => openEdit(r)}
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
                    transition: "background 0.1s",
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
                    transition: "background 0.1s",
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
        data={data?.employees ?? []}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyText="No employees found"
      />

      {/* Add Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Employee"
        width={400}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Employee ID" required>
            <Input
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              placeholder="e.g. 0088"
            />
          </FormField>
          <FormField label="Full Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Smith"
            />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Btn>
            <Btn icon={Plus} loading={saving} onClick={handleSave}>
              Add Employee
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Employee"
        width={400}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="Employee ID">
            <Input value={editTarget?.empId ?? ""} disabled />
          </FormField>
          <FormField label="Full Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </FormField>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setEditTarget(null)}>
              Cancel
            </Btn>
            <Btn icon={Pencil} loading={saving} onClick={handleSave}>
              Save Changes
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
