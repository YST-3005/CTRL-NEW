import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Panel({
  children,
  className,
  title,
  kicker,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  kicker?: string;
}) {
  return (
    <section className={cn("hud-panel rounded-2xl p-5 md:p-6", className)}>
      {(kicker || title) && (
        <header className="mb-4">
          {kicker && <p className="hud-label">{kicker}</p>}
          {title && <h2 className="mt-1 text-xl text-cyan-100">{title}</h2>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "cyan",
}: {
  children: ReactNode;
  tone?: "cyan" | "violet" | "amber" | "alert" | "ok" | "muted";
}) {
  const map = {
    cyan: "border-cyan-400/40 text-cyan-200 bg-cyan-400/10",
    violet: "border-violet-400/40 text-violet-200 bg-violet-400/10",
    amber: "border-amber-400/40 text-amber-200 bg-amber-400/10",
    alert: "border-rose-400/40 text-rose-200 bg-rose-500/10",
    ok: "border-emerald-400/40 text-emerald-200 bg-emerald-400/10",
    muted: "border-white/10 text-slate-300 bg-white/5",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs tracking-wide", map[tone])}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled,
  className,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary:
      "bg-cyan-400/90 text-slate-950 hover:bg-cyan-300 shadow-[0_0_24px_rgba(60,239,255,0.25)]",
    ghost: "border border-cyan-400/30 bg-transparent text-cyan-100 hover:bg-cyan-400/10",
    danger: "bg-rose-500/80 text-white hover:bg-rose-400",
  };
  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        sizeStyles[size],
        styles[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="hud-label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-cyan-400/20 bg-slate-950/60 px-3 py-2.5 text-sm text-cyan-50 placeholder:text-slate-500";
