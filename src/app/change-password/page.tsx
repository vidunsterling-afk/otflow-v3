/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 8 characters", pass: password.length >= 8 },
    { label: "Contains a number", pass: /\d/.test(password) },
    { label: "Contains uppercase", pass: /[A-Z]/.test(password) },
    { label: "Contains lowercase", pass: /[a-z]/.test(password) },
    {
      label: "Contains special character",
      pass: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const score = checks.filter((c) => c.pass).length;
  const strengthLabel =
    score <= 1 ? "Weak" : score <= 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  const strengthColor =
    score <= 1
      ? "var(--status-rejected-text)"
      : score <= 3
        ? "var(--status-pending-text)"
        : score === 4
          ? "var(--brand-500)"
          : "var(--status-approved-text)";

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      style={{ overflow: "hidden" }}
    >
      <div style={{ marginTop: 8 }}>
        {/* Strength bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 99,
                background: i <= score ? strengthColor : "var(--border-base)",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            Password strength
          </span>
          <span
            style={{ fontSize: 11.5, fontWeight: 700, color: strengthColor }}
          >
            {strengthLabel}
          </span>
        </div>
        {/* Checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {checks.map(({ label, pass }) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: pass
                    ? "var(--status-approved-bg)"
                    : "var(--bg-muted)",
                  border: `1px solid ${pass ? "var(--status-approved-border)" : "var(--border-base)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {pass && (
                  <CheckCircle2 size={9} color="var(--status-approved-text)" />
                )}
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  color: pass
                    ? "var(--status-approved-text)"
                    : "var(--text-muted)",
                  transition: "color 0.15s",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function ChangePasswordPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user as any;

  // Redirect to dashboard if user doesn't need to change password
  useEffect(() => {
    if (session && !(session.user as any)?.mustChangePassword) {
      router.replace("/dashboard");
    }
    if (!session && status === "unauthenticated") {
      router.replace("/login");
    }
  }, [session, status, router]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to change password");

      toast.success("Password changed - please sign in with your new password");

      // Sign out to force a fresh token without mustChangePassword flag
      await signOut({ redirect: false });
      router.replace("/login?passwordChanged=true");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const isMustChange = user?.mustChangePassword;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-card)",
          border: `1px solid ${isMustChange ? "var(--status-pending-border)" : "var(--border-base)"}`,
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-modal)",
          overflow: "hidden",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            height: 4,
            background: isMustChange
              ? "var(--status-pending-text)"
              : "var(--brand-500)",
          }}
        />

        <div style={{ padding: "28px 32px 32px" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: isMustChange
                  ? "var(--status-pending-bg)"
                  : "var(--brand-50)",
                border: `1px solid ${isMustChange ? "var(--status-pending-border)" : "var(--brand-100)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isMustChange ? (
                <ShieldAlert size={20} color="var(--status-pending-text)" />
              ) : (
                <Lock size={20} color="var(--brand-500)" />
              )}
            </div>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.4px",
                }}
              >
                {isMustChange ? "Password Change Required" : "Change Password"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginTop: 3,
                  lineHeight: 1.5,
                }}
              >
                {isMustChange
                  ? "Your account requires a new password before you can continue. This is required for security."
                  : "Choose a new password for your account."}
              </div>
            </div>
          </div>

          {/* Mandatory warning */}
          {isMustChange && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: "10px 12px",
                marginBottom: 20,
                background: "var(--status-pending-bg)",
                border: "1px solid var(--status-pending-border)",
                borderRadius: "var(--radius-md)",
                fontSize: 12.5,
                color: "var(--status-pending-text)",
                display: "flex",
                alignItems: "flex-start",
                gap: 7,
                lineHeight: 1.5,
              }}
            >
              <ShieldAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {user?.username && (
                  <>
                    <strong>{user.username}</strong> —{" "}
                  </>
                )}
                Your password was set by an administrator or this is your first
                login. You must set a personal password to continue.
              </span>
            </motion.div>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Current password */}
            <div>
              <label
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                {isMustChange
                  ? "Temporary / Current Password"
                  : "Current Password"}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  style={{
                    width: "100%",
                    padding: "9px 38px 9px 12px",
                    border: "1px solid var(--border-base)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13.5,
                    color: "var(--text-primary)",
                    background: "var(--bg-base)",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--brand-400)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--border-base)")
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((p) => !p)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                  }}
                >
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--border-base)" }} />

            {/* New password */}
            <div>
              <label
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{
                    width: "100%",
                    padding: "9px 38px 9px 12px",
                    border: "1px solid var(--border-base)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13.5,
                    color: "var(--text-primary)",
                    background: "var(--bg-base)",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--brand-400)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--border-base)")
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowNew((p) => !p)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                  }}
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>

            {/* Confirm password */}
            <div>
              <label
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Confirm New Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  style={{
                    width: "100%",
                    padding: "9px 38px 9px 12px",
                    border: `1px solid ${
                      confirmPassword && confirmPassword !== newPassword
                        ? "var(--status-rejected-border)"
                        : confirmPassword && confirmPassword === newPassword
                          ? "var(--status-approved-border)"
                          : "var(--border-base)"
                    }`,
                    borderRadius: "var(--radius-md)",
                    fontSize: 13.5,
                    color: "var(--text-primary)",
                    background: "var(--bg-base)",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--brand-400)")
                  }
                  onBlur={(e) => {
                    e.target.style.borderColor =
                      confirmPassword && confirmPassword !== newPassword
                        ? "var(--status-rejected-border)"
                        : confirmPassword && confirmPassword === newPassword
                          ? "var(--status-approved-border)"
                          : "var(--border-base)";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    display: "flex",
                  }}
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {confirmPassword && confirmPassword === newPassword && (
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 11.5,
                    color: "var(--status-approved-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <CheckCircle2 size={11} /> Passwords match
                </div>
              )}
              {confirmPassword && confirmPassword !== newPassword && (
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 11.5,
                    color: "var(--status-rejected-text)",
                  }}
                >
                  Passwords do not match
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: "9px 12px",
                  background: "var(--status-rejected-bg)",
                  border: "1px solid var(--status-rejected-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12.5,
                  color: "var(--status-rejected-text)",
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={
                loading ||
                !currentPassword ||
                !newPassword ||
                newPassword !== confirmPassword
              }
              style={{
                marginTop: 4,
                padding: "11px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background:
                  loading ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword !== confirmPassword
                    ? "var(--bg-muted)"
                    : isMustChange
                      ? "var(--status-pending-text)"
                      : "var(--brand-500)",
                color:
                  loading ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword !== confirmPassword
                    ? "var(--text-muted)"
                    : "white",
                fontWeight: 700,
                fontSize: 14,
                cursor:
                  loading ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword !== confirmPassword
                    ? "not-allowed"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.15s",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Changing
                  password...
                </>
              ) : (
                <>
                  <ArrowRight size={14} /> Set New Password
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
