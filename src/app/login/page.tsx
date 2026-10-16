"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { z } from "zod";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Button, Field, Panel, inputClass } from "@/components/ui/Hud";
import { IdentityCore } from "@/components/three/LabCanvas";

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(10, "Password must be at least 10 characters."),
});

export default function LoginPage() {
  const router = useRouter();
  const login = useGuardianStore((s) => s.login);
  const loginDemo = useGuardianStore((s) => s.loginDemo);
  const authError = useGuardianStore((s) => s.authError);
  const authBusy = useGuardianStore((s) => s.authBusy);
  const [show, setShow] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    setFieldError(null);
    const ok = await login(parsed.data.email, parsed.data.password);
    if (ok) router.push("/scanner");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <LabCanvas className="h-[320px] md:h-full min-h-[320px]" autoRotate={false}>
        <IdentityCore scanning={authBusy} />
      </LabCanvas>
      <Panel kicker="Identity chamber · DEMO AUTH" title="Authenticate">
        <p className="mb-4 text-sm text-amber-200">
          Production Supabase auth is not claimed here. This is a labeled local demo session (passwords hashed in the
          browser, never stored in plaintext).
        </p>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <Field label="Email">
            <input className={inputClass} name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Password">
            <div className="flex gap-2">
              <input
                className={inputClass}
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <Button variant="ghost" onClick={() => setShow((v) => !v)} aria-pressed={show}>
                {show ? "Hide" : "Show"}
              </Button>
            </div>
          </Field>
          {(fieldError || authError) && (
            <p className="text-sm text-rose-300" role="alert">
              {fieldError || authError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={authBusy}>
              {authBusy ? "Scanning identity…" : "Login"}
            </Button>
            <Button
              variant="ghost"
              disabled={authBusy}
              onClick={async () => {
                const ok = await loginDemo();
                if (ok) router.push("/scanner");
              }}
            >
              Enter demo mode
            </Button>
          </div>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          No chamber key? <Link href="/register" className="text-cyan-300">Register</Link>
          {" · "}
          <Link href="/reset-password" className="text-cyan-300">Reset password</Link>
        </p>
      </Panel>
    </div>
  );
}
