/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import "./login.css";

function LoginPageInner() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { logo, companyName, isLoading } = useCompanySettings();

  const searchParams = useSearchParams();
  const passwordChanged = searchParams.get("passwordChanged") === "true";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        console.error("Login error:", res.error);
        if (res.error === "account_disabled") {
          const message =
            "Account rejected (disabled). Contact your administrator.";
          setError(message);
          toast.error(message);
        } else {
          setError("Invalid username or password.");
          toast.error("Invalid username or password.");
        }
      } else if (res?.ok) {
        toast.success("Login successful.");
        router.push("/dashboard");
      } else {
        setError("Something went wrong. Please try again.");
        toast.error("Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Something went wrong. Please try again.");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      {/* ---------------- Brand panel ---------------- */}
      <div className="login-brand">
        <div className="login-brand__grid" aria-hidden="true" />
        <div className="login-brand__glow" aria-hidden="true" />
        <div className="login-brand__glow login-brand__glow--alt" aria-hidden="true" />

        <svg
          className="login-brand__clock"
          width="440"
          height="440"
          viewBox="0 0 440 440"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="220" cy="220" r="190" stroke="currentColor" strokeOpacity="0.35" />
          <circle cx="220" cy="220" r="150" stroke="currentColor" strokeOpacity="0.18" />
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "220px 220px" }}
          >
            <circle
              cx="220"
              cy="220"
              r="170"
              stroke="currentColor"
              strokeOpacity="0.45"
              strokeDasharray="2 12"
              strokeLinecap="round"
            />
          </motion.g>
          <path d="M220 220 L220 112" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
          <path d="M220 220 L292 256" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          <circle cx="220" cy="220" r="5" fill="currentColor" fillOpacity="0.6" />
        </svg>

        <div className="login-brand__logo">
          <div className="login-logo-mark">
            {isLoading ? (
              <Loader2 size={20} color="#fff" className="animate-spin" />
            ) : logo ? (
              <img src={logo} alt={companyName || "Company logo"} />
            ) : (
              <Clock size={22} color="#fff" fill="#fff" />
            )}
          </div>
          <div>
            <div className="login-brand__title">OTFlow</div>
            <div className="login-brand__subtitle">Overtime Management</div>
          </div>
        </div>

        <div className="login-brand__mobile-tagline">
          Overtime, made simple. Track, approve and report in one place.
        </div>

        <div className="login-brand__body">
          <h2 className="login-headline">
            Overtime,
            <br />
            <span>made simple.</span>
          </h2>
          <p className="login-lede">
            One place for your team to log overtime, managers to make decisions,
            and HR to turn it all into clean, payroll-ready reports.
          </p>
        </div>

        <div className="login-brand__footer">
          <div className="login-brand__footer-line" />
          <div className="login-brand__footer-company">
            {companyName || "Overtime Management"}
          </div>
          <div className="login-brand__footer-credit">
            Developed by Vidun Hettiarachchi · © {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* ---------------- Form panel ---------------- */}
      <div className="login-form-panel">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">
            Sign in to your account to continue to your workspace.
          </p>

          {passwordChanged && (
            <motion.div
              className="login-notice"
              role="status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CheckCircle2 size={15} />
              Password changed successfully — sign in with your new password
            </motion.div>
          )}

          {error && (
            <motion.div
              className="login-error"
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={15} />
              {error}
            </motion.div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-username">
                Username
              </label>
              <div className="login-input-wrap">
                <User size={16} className="login-input__icon" aria-hidden="true" />
                <input
                  id="login-username"
                  name="username"
                  className="login-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Password
              </label>
              <div className="login-input-wrap">
                <Lock size={16} className="login-input__icon" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  className="login-input login-input--with-toggle"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                  onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                  onBlur={() => setCapsLock(false)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-toggle"
                  onClick={() => setShowPass((p) => !p)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {capsLock && (
                <div className="login-caps" role="status">
                  <AlertCircle size={13} />
                  Caps Lock is on
                </div>
              )}
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} className="login-submit__arrow" />
                </>
              )}
            </button>
          </form>

          <div className="login-help">
            <div className="login-help__icon">
              <Info size={15} />
            </div>
            <div className="login-help__text">
              <strong>Need access?</strong> Contact your administrator to get an
              account or sort out access requirements.
            </div>
          </div>

          <div className="login-credit">Developed by Vidun Hettiarachchi</div>
        </motion.div>
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
