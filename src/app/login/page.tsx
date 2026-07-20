/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, Eye, EyeOff, Loader2, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";

function LoginPageInner() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const { logo, companyName, isLoading } = useCompanySettings();

  const searchParams = useSearchParams();
  const passwordChanged = searchParams.get("passwordChanged") === "true";

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
              background: logo ? "white" : "var(--brand-500)",
              border: logo ? "1px solid var(--border-base)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {isLoading ? (
              <Clock size={18} color="white" />
            ) : logo ? (
              <img
                src={logo}
                alt={companyName}
                style={{ height: 28, maxWidth: 34, objectFit: "contain" }}
              />
            ) : (
              <Zap size={16} color="white" fill="white" />
            )}
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
              OTFlow
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

        {passwordChanged && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "9px 12px",
              marginBottom: 4,
              borderRadius: "var(--radius-md)",
              background: "var(--status-approved-bg)",
              border: "1px solid var(--status-approved-border)",
              fontSize: 12.5,
              color: "var(--status-approved-text)",
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontWeight: 500,
            }}
          >
            <CheckCircle2 size={13} />
            Password changed successfully — sign in with your new password
          </motion.div>
        )}

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

        {/* Contact administrator note */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid var(--border-base)",
            fontSize: 12,
            color: "var(--text-muted)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Need an account or have other access requirements?
          <br />
          Contact your administrator.
        </div>
      </motion.div>

      {/* Developed by badge */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          color: "var(--text-muted)",
          letterSpacing: "0.2px",
        }}
      >
        Developed by Vidun Hettiarachchi
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
