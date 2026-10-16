"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Button, Field, Panel, inputClass } from "@/components/ui/Hud";

const schema = z
  .object({
    displayName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(10),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export default function RegisterPage() {
  const router = useRouter();
  const register = useGuardianStore((s) => s.register);
  const authError = useGuardianStore((s) => s.authError);
  const authBusy = useGuardianStore((s) => s.authBusy);
  const [show, setShow] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      displayName: fd.get("displayName"),
      email: fd.get("email"),
      password: fd.get("password"),
      confirm: fd.get("confirm"),
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    const ok = await register(parsed.data.email, parsed.data.password, parsed.data.displayName);
    if (ok) router.push("/scanner");
  }

  return (
    <Panel kicker="Identity enrollment · DEMO" title="Create analyst profile">
      <form className="mx-auto max-w-md space-y-4" onSubmit={onSubmit}>
        <Field label="Display name">
          <input className={inputClass} name="displayName" required />
        </Field>
        <Field label="Email">
          <input className={inputClass} name="email" type="email" required />
        </Field>
        <Field label="Password">
          <div className="flex gap-2">
            <input className={inputClass} name="password" type={show ? "text" : "password"} required />
            <Button variant="ghost" onClick={() => setShow((v) => !v)}>
              {show ? "Hide" : "Show"}
            </Button>
          </div>
        </Field>
        <Field label="Confirm password">
          <input className={inputClass} name="confirm" type={show ? "text" : "password"} required />
        </Field>
        {(fieldError || authError) && (
          <p className="text-sm text-rose-300" role="alert">
            {fieldError || authError}
          </p>
        )}
        <Button type="submit" disabled={authBusy}>
          Register
        </Button>
        <p className="text-sm text-slate-400">
          Already enrolled? <Link href="/login" className="text-cyan-300">Login</Link>
        </p>
      </form>
    </Panel>
  );
}
