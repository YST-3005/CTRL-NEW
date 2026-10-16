"use client";

import { FormEvent, useState } from "react";
import { Button, Field, Panel, inputClass } from "@/components/ui/Hud";

export default function ResetPage() {
  const [sent, setSent] = useState(false);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }
  return (
    <Panel kicker="Recovery" title="Password reset">
      <p className="mb-4 text-sm text-amber-200">
        Demo mode cannot send email. If Supabase is configured, this flow would call{" "}
        <code>resetPasswordForEmail</code>. No reset email was dispatched.
      </p>
      <form className="max-w-md space-y-4" onSubmit={onSubmit}>
        <Field label="Account email">
          <input className={inputClass} type="email" name="email" required />
        </Field>
        <Button type="submit">Queue reset (demo)</Button>
      </form>
      {sent && (
        <p className="mt-4 text-sm text-cyan-200" role="status">
          Demo acknowledgement only — no email provider was contacted.
        </p>
      )}
    </Panel>
  );
}
