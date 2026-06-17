"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Building2, Check, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { FormField, Input } from "@/components/ui/FormField";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}

export function LogoSettings({ open, onClose, onSaved }: Props) {
  const [logo, setLogo] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    fetch("/api/settings/logo")
      .then((r) => r.json())
      .then((d) => {
        setLogo(d.logo ?? null);
        setPreview(
          d.logo
            ? `data:image/png;base64,${d.logo.replace(/^data:.*?;base64,/, "")}`
            : null,
        );
        setCompanyName(d.companyName ?? "");
      })
      .finally(() => setFetching(false));
  }, [open]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("Logo must be under 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setLogo(b64);
      setPreview(b64);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo, companyName }),
      });
      if (!res.ok) throw new Error();
      toast.success("Settings saved");
      onSaved(companyName);
      onClose();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveLogo() {
    setLogo(null);
    setPreview(null);
    await fetch("/api/settings/logo", { method: "DELETE" });
    toast.success("Logo removed");
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "absolute",
              inset: 0,
              background: "oklch(0.18 0.02 264 / 0.4)",
              backdropFilter: "blur(4px)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 440,
              background: "var(--bg-card)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border-base)",
              boxShadow: "var(--shadow-modal)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 22px 14px",
                borderBottom: "1px solid var(--border-base)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--brand-50)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Building2 size={15} color="var(--brand-600)" />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    Company Settings
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    Logo & name shown in exports
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-base)",
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <X size={12} />
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "20px 22px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {fetching ? (
                <div
                  style={{
                    padding: "32px 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Loader2
                    size={20}
                    className="animate-spin"
                    color="var(--text-muted)"
                  />
                </div>
              ) : (
                <>
                  <FormField
                    label="Company Name"
                    hint="Appears at the top of every exported Excel file"
                  >
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme Corporation"
                    />
                  </FormField>

                  <div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        marginBottom: 8,
                      }}
                    >
                      Company Logo{" "}
                      <span
                        style={{ color: "var(--text-muted)", fontWeight: 400 }}
                      >
                        (shown in exports · max 500KB)
                      </span>
                    </div>

                    {preview ? (
                      <div
                        style={{
                          border: "1px solid var(--border-base)",
                          borderRadius: "var(--radius-md)",
                          padding: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          background: "var(--bg-muted)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <img
                            src={preview}
                            alt="Company logo"
                            style={{
                              height: 48,
                              maxWidth: 120,
                              objectFit: "contain",
                              borderRadius: 4,
                            }}
                          />
                          <div>
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: 500,
                                color: "var(--text-primary)",
                              }}
                            >
                              Logo uploaded
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              Will appear in all Excel exports
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => fileRef.current?.click()}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border-base)",
                              background: "var(--bg-card)",
                              fontSize: 11.5,
                              color: "var(--text-secondary)",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Change
                          </button>
                          <button
                            onClick={handleRemoveLogo}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--status-rejected-border)",
                              background: "var(--status-rejected-bg)",
                              fontSize: 11.5,
                              color: "var(--status-rejected-text)",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        style={{
                          width: "100%",
                          padding: "24px 16px",
                          border: "2px dashed var(--border-strong)",
                          borderRadius: "var(--radius-md)",
                          background: "var(--bg-muted)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "var(--brand-300)";
                          (e.currentTarget as HTMLElement).style.background =
                            "var(--brand-50)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            "var(--border-strong)";
                          (e.currentTarget as HTMLElement).style.background =
                            "var(--bg-muted)";
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "var(--radius-md)",
                            background: "var(--bg-card)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid var(--border-base)",
                          }}
                        >
                          <ImageIcon size={16} color="var(--text-muted)" />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "var(--text-secondary)",
                            }}
                          >
                            Click to upload logo
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: "var(--text-muted)",
                            }}
                          >
                            PNG, JPG, SVG · Max 500KB
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 12px",
                            borderRadius: 99,
                            border: "1px solid var(--border-base)",
                            background: "var(--bg-card)",
                            fontSize: 12,
                            color: "var(--brand-500)",
                            fontWeight: 500,
                          }}
                        >
                          <Upload size={11} /> Browse
                        </div>
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      style={{ display: "none" }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                      paddingTop: 4,
                    }}
                  >
                    <button
                      onClick={onClose}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-base)",
                        background: "transparent",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      style={{
                        padding: "8px 18px",
                        borderRadius: "var(--radius-md)",
                        border: "none",
                        background: loading
                          ? "var(--brand-300)"
                          : "var(--brand-500)",
                        color: "white",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: loading ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {loading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Check size={13} />
                      )}
                      Save Settings
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
