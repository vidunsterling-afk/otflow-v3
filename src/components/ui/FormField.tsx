interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

export function FormField({
  label,
  required,
  error,
  children,
  hint,
}: FormFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: error
            ? "var(--status-rejected-text)"
            : "var(--text-secondary)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--status-rejected-text)", marginLeft: 2 }}>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: "var(--status-rejected-text)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, style, ...props }: InputProps) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "8px 11px",
        border: `1px solid ${error ? "var(--status-rejected-border)" : "var(--border-base)"}`,
        borderRadius: "var(--radius-md)",
        fontSize: 13.5,
        color: "var(--text-primary)",
        background: props.disabled ? "var(--bg-muted)" : "var(--bg-base)",
        outline: "none",
        transition: "border-color 0.15s",
        ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "var(--brand-400)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error
          ? "var(--status-rejected-border)"
          : "var(--border-base)";
        props.onBlur?.(e);
      }}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, style, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "8px 11px",
        border: `1px solid ${error ? "var(--status-rejected-border)" : "var(--border-base)"}`,
        borderRadius: "var(--radius-md)",
        fontSize: 13.5,
        color: "var(--text-primary)",
        background: props.disabled ? "var(--bg-muted)" : "var(--bg-base)",
        outline: "none",
        transition: "border-color 0.15s",
        cursor: props.disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "var(--brand-400)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error
          ? "var(--status-rejected-border)"
          : "var(--border-base)";
        props.onBlur?.(e);
      }}
    >
      {children}
    </select>
  );
}

export function Textarea({
  error,
  style,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "8px 11px",
        border: `1px solid ${error ? "var(--status-rejected-border)" : "var(--border-base)"}`,
        borderRadius: "var(--radius-md)",
        fontSize: 13.5,
        color: "var(--text-primary)",
        background: "var(--bg-base)",
        outline: "none",
        transition: "border-color 0.15s",
        resize: "vertical",
        minHeight: 72,
        fontFamily: "inherit",
        ...style,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "var(--brand-400)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error
          ? "var(--status-rejected-border)"
          : "var(--border-base)";
        props.onBlur?.(e);
      }}
    />
  );
}
