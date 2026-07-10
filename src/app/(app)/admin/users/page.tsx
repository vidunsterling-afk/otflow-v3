/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldOff,
  KeyRound,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Btn } from "@/components/admin/PrimaryBtn";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions";

interface Role {
  id: string;
  name: string;
  permissions: string[];
}
interface User {
  id: string;
  email: string;
  username: string;
  canApprove: boolean;
  isActive: boolean;
  role: Role;
  createdAt: string;
}

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

function PermTag({ perm }: { perm: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 99,
        background: "var(--brand-50)",
        color: "var(--brand-600)",
        border: "1px solid var(--brand-100)",
      }}
    >
      {perm.replace(":", ": ")}
    </span>
  );
}

export default function UsersPage() {
  const { data: session } = useSession();
  const selfId = (session?.user as any)?.id;
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    roleId: "",
    canApprove: false,
  });
  const [saving, setSaving] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then((r) => r.json()),
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: () => fetch("/api/admin/roles").then((r) => r.json()),
  });

  function openAdd() {
    setEditTarget(null);
    setForm({
      email: "",
      username: "",
      password: "",
      roleId: roles[0]?.id ?? "",
      canApprove: false,
    });
    setModalOpen(true);
  }

  function openEdit(u: User) {
    setEditTarget(u);
    setForm({
      email: u.email,
      username: u.username,
      password: "",
      roleId: u.role.id,
      canApprove: u.canApprove,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editTarget) {
        const body: any = {
          email: form.email,
          username: form.username,
          roleId: form.roleId,
          canApprove: form.canApprove,
        };
        if (form.password) body.password = form.password;
        const res = await fetch(`/api/admin/users/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
        toast.success("User updated");
      } else {
        if (!form.password) {
          toast.error("Password required");
          return;
        }
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
        toast.success("User created");
      }
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      toast.success(`User ${u.isActive ? "deactivated" : "activated"}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } else toast.error("Failed");
  }

  async function handleResetPassword(u: User) {
    const newPass = prompt(`Enter temporary password for "${u.username}":`);
    if (!newPass) return;
    if (newPass.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPass }),
    });

    if (res.ok) {
      toast.success(
        `Password reset for ${u.username} — they will be forced to change it on next login`,
      );
    } else {
      toast.error("Failed to reset password");
    }
  }

  async function handleDelete(u: User) {
    if (u.id === selfId) {
      toast.error("Cannot delete your own account");
      return;
    }
    if (!confirm(`Delete user "${u.username}"?`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } else toast.error("Failed");
  }

  const selectedRole = roles.find((r) => r.id === form.roleId);

  return (
    <div>
      <AdminPageHeader
        title="Users"
        sub={`${users.length} system users`}
        icon={UserCog}
        action={
          <Btn icon={Plus} onClick={openAdd}>
            Add User
          </Btn>
        }
      />

      <AdminTable
        columns={[
          {
            key: "user",
            label: "User",
            render: (u) => (
              <div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {u.username}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {u.email}
                </div>
              </div>
            ),
          },
          {
            key: "role",
            label: "Role",
            width: "120px",
            render: (u) => (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "var(--brand-50)",
                  color: "var(--brand-600)",
                  border: "1px solid var(--brand-100)",
                }}
              >
                {u.role.name}
              </span>
            ),
          },
          {
            key: "approve",
            label: "Can Approve",
            width: "110px",
            render: (u) => (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: u.canApprove
                    ? "var(--status-approved-bg)"
                    : "var(--bg-muted)",
                  color: u.canApprove
                    ? "var(--status-approved-text)"
                    : "var(--text-muted)",
                }}
              >
                {u.canApprove ? "Yes" : "No"}
              </span>
            ),
          },
          {
            key: "status",
            label: "Status",
            width: "100px",
            render: (u) => (
              <StatusBadge status={u.isActive ? "APPROVED" : "REJECTED"} />
            ),
          },
          {
            key: "actions",
            label: "",
            width: "110px",
            render: (u) => (
              <div
                style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}
              >
                <button
                  title={u.isActive ? "Deactivate" : "Activate"}
                  onClick={() => toggleActive(u)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: u.isActive
                      ? "var(--status-rejected-text)"
                      : "var(--status-approved-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      u.isActive
                        ? "var(--status-rejected-bg)"
                        : "var(--status-approved-bg)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  {u.isActive ? (
                    <ShieldOff size={13} />
                  ) : (
                    <ShieldCheck size={13} />
                  )}
                </button>
                <button
                  onClick={() => openEdit(u)}
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
                  onClick={() => handleResetPassword(u)}
                  title="Reset password"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--status-pending-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--status-pending-bg)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  <KeyRound size={13} />
                </button>
                {u.id !== selfId && (
                  <button
                    onClick={() => handleDelete(u)}
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
                )}
              </div>
            ),
          },
        ]}
        data={users}
        keyFn={(u) => u.id}
        loading={isLoading}
        emptyText="No users found"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit User" : "Add User"}
        width={520}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <FormField label="Username" required>
              <Input
                value={form.username}
                onChange={(e) =>
                  setForm((p) => ({ ...p, username: e.target.value }))
                }
                placeholder="john_doe"
              />
            </FormField>
            <FormField label="Email" required>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="john@example.com"
              />
            </FormField>
          </div>

          <FormField
            label={
              editTarget ? "New Password (leave blank to keep)" : "Password"
            }
            required={!editTarget}
          >
            <Input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="••••••••"
            />
          </FormField>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <FormField label="Role" required>
              <Select
                value={form.roleId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, roleId: e.target.value }))
                }
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Can Approve OT">
              <Select
                value={form.canApprove ? "yes" : "no"}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    canApprove: e.target.value === "yes",
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </FormField>
          </div>

          {/* Role permissions preview */}
          {selectedRole && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--bg-muted)",
                border: "1px solid var(--border-base)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Permissions from &quot;{selectedRole.name}&quot; role
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {selectedRole.permissions.length === 0 ? (
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    No permissions
                  </span>
                ) : (
                  selectedRole.permissions.map((p) => (
                    <PermTag key={p} perm={p} />
                  ))
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Btn>
            <Btn
              icon={editTarget ? Pencil : Plus}
              loading={saving}
              onClick={handleSave}
            >
              {editTarget ? "Save Changes" : "Create User"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
