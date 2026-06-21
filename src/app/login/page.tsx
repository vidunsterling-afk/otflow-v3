"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Database } from "@deemlol/next-icons";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // DB Status
  const [dbStatus, setDbStatus] = useState<"loading" | "ok" | "error">(
    "loading",
  );

  useEffect(() => {
    async function checkDB() {
      try {
        const res = await fetch("/api/health/db");
        const data = await res.json();
        if (data.status === "ok") setDbStatus("ok");
        else setDbStatus("error");
      } catch (err) {
        console.error("DB ERROR:", err);
        setDbStatus("error");
      }
    }

    checkDB();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        console.error("Login error:", res.error);
        if (res.error === "account_disabled") {
          toast.error(
            "Account rejected (disabled). Contact your administrator.",
          );
        } else {
          toast.error("Invalid username or password.");
        }
      } else if (res?.ok) {
        toast.success("Login successful.");
        router.push("/dashboard");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Sign in error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
      <div
        style={{
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          top: 16,
          right: 16,
          fontSize: 11,
          padding: "4px 8px",
          borderRadius: 999,
          background:
            dbStatus === "ok"
              ? "rgba(34, 197, 94, 0.15)"
              : dbStatus === "error"
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(148, 163, 184, 0.15)",
          color:
            dbStatus === "ok"
              ? "#22c55e"
              : dbStatus === "error"
                ? "#ef4444"
                : "#94a3b8",
          border: "1px solid currentColor",
        }}
      >
        <Database size={16} />: {dbStatus.toUpperCase()}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-card)",
          border: "1px solid var(--border-base)",
          borderRadius: "var(--radius-xl)",
          padding: 32,
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--radius-md)",
              background: "var(--brand-500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Clock size={18} color="white" />
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: "-0.4px",
                color: "var(--text-primary)",
              }}
            >
              OTFlow V3
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Overtime Management
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 20,
              color: "var(--text-primary)",
              letterSpacing: "-0.4px",
            }}
          >
            Welcome back
          </div>
          <div
            style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}
          >
            Sign in to your account
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
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
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--border-base)",
                borderRadius: "var(--radius-md)",
                fontSize: 13.5,
                color: "var(--text-primary)",
                background: "var(--bg-base)",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--brand-400)")}
              onBlur={(e) =>
                (e.target.style.borderColor = "var(--border-base)")
              }
            />
          </div>

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
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
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
                onClick={() => setShowPass((p) => !p)}
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
                  alignItems: "center",
                }}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "10px",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: loading ? "var(--brand-300)" : "var(--brand-500)",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.15s",
            }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
