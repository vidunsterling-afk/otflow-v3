"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Pencil, Trash2, Check } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Btn } from "@/components/admin/PrimaryBtn";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input } from "@/components/ui/FormField";
import { toast } from "sonner";
import { PERMISSIONS } from "@/lib/permissions";
import { motion } from "framer-motion";

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

const PERMISSION_GROUPS = [
  {
    label: "OT Entries",
    permissions: [
      PERMISSIONS.OT_VIEW,
      PERMISSIONS.OT_CREATE,
      PERMISSIONS.OT_EDIT,
      PERMISSIONS.OT_APPROVE,
      PERMISSIONS.OT_MANUAL_OVERRIDE,
    ],
  },
  {
    label: "Logs",
    permissions: [PERMISSIONS.LOGS_VIEW, PERMISSIONS.LOGS_EXPORT],
  },
  {
    label: "Admin",
    permissions: [
      PERMISSIONS.ADMIN_EMPLOYEES,
      PERMISSIONS.ADMIN_USERS,
      PERMISSIONS.ADMIN_ROLES,
      PERMISSIONS.ADMIN_AUDIT,
    ],
  },
  { label: "System", permissions: [PERMISSIONS.TRIPLE_DAYS_MANAGE] },
];

export default function RolesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: () => fetch("/api/admin/roles").then((r) => r.json()),
  });

  function openAdd() {
    setEditTarget(null);
    setRoleName("");
    setSelectedPerms([]);
    setModalOpen(true);
  }

  function openEdit(r: Role) {
    setEditTarget(r);
    setRoleName(r.name);
    setSelectedPerms([...r.permissions]);
    setModalOpen(true);
  }

  function togglePerm(p: string) {
    setSelectedPerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function toggleGroup(perms: string[]) {
    const allSelected = perms.every((p) => selectedPerms.includes(p));
    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((p) => !perms.includes(p)));
    } else {
      setSelectedPerms((prev) => [...new Set([...prev, ...perms])]);
    }
  }

  async function handleSave() {
    if (!roleName.trim()) {
      toast.error("Role name required");
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        const res = await fetch(`/api/admin/roles/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: roleName, permissions: selectedPerms }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Role updated");
      } else {
        const res = await fetch("/api/admin/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: roleName, permissions: selectedPerms }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Role created");
      }
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ["roles"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: Role) {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/roles/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["roles"] });
    } else {
      const e = await res.json();
      toast.error(e.error ?? "Failed");
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Roles & Permissions"
        sub="Define what each role can access"
        icon={Shield}
        action={
          <Btn icon={Plus} onClick={openAdd}>
            Create Role
          </Btn>
        }
      />

      {isLoading && (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Loading...
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {roles.map((role, i) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              borderRadius: "var(--radius-lg)",
              padding: "16px 18px",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.2px",
                  }}
                >
                  {role.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  {role.permissions.length} permission
                  {role.permissions.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn
                  icon={Pencil}
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(role)}
                >
                  Edit
                </Btn>
                <Btn
                  icon={Trash2}
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(role)}
                >
                  Delete
                </Btn>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {role.permissions.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  No permissions assigned
                </span>
              ) : (
                role.permissions.map((p) => (
                  <span
                    key={p}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 99,
                      background: "var(--brand-50)",
                      color: "var(--brand-600)",
                      border: "1px solid var(--brand-100)",
                    }}
                  >
                    {p}
                  </span>
                ))
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Role" : "Create Role"}
        width={540}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FormField label="Role Name" required>
            <Input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. supervisor"
            />
          </FormField>

          <div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: 10,
              }}
            >
              Permissions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {PERMISSION_GROUPS.map((group) => {
                const allSelected = group.permissions.every((p) =>
                  selectedPerms.includes(p),
                );
                return (
                  <div
                    key={group.label}
                    style={{
                      border: "1px solid var(--border-base)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() => toggleGroup(group.permissions)}
                      style={{
                        padding: "9px 12px",
                        background: allSelected
                          ? "var(--brand-50)"
                          : "var(--bg-muted)",
                        borderBottom: "1px solid var(--border-base)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: `1px solid ${allSelected ? "var(--brand-400)" : "var(--border-strong)"}`,
                          background: allSelected
                            ? "var(--brand-500)"
                            : "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {allSelected && (
                          <Check size={10} color="white" strokeWidth={3} />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {group.label}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "10px 12px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {group.permissions.map((perm) => {
                        const checked = selectedPerms.includes(perm);
                        return (
                          <label
                            key={perm}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                            }}
                          >
                            <div
                              onClick={() => togglePerm(perm)}
                              style={{
                                width: 15,
                                height: 15,
                                borderRadius: 3,
                                border: `1px solid ${checked ? "var(--brand-400)" : "var(--border-strong)"}`,
                                background: checked
                                  ? "var(--brand-500)"
                                  : "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              {checked && (
                                <Check size={9} color="white" strokeWidth={3} />
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {perm}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Btn>
            <Btn
              icon={editTarget ? Pencil : Plus}
              loading={saving}
              onClick={handleSave}
            >
              {editTarget ? "Save Changes" : "Create Role"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
