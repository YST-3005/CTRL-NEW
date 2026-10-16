"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Button, Field, Panel, inputClass, Badge } from "@/components/ui/Hud";
import { TransmissionPulse } from "@/components/three/LabCanvas";

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

export default function CaregiverPage() {
  const caregiver = useGuardianStore((s) => s.caregiver);
  const optIn = useGuardianStore((s) => s.caregiverOptIn);
  const setCaregiver = useGuardianStore((s) => s.setCaregiver);
  const setOptIn = useGuardianStore((s) => s.setCaregiverOptIn);
  const triggerAlert = useGuardianStore((s) => s.triggerAlert);
  const deleteAlert = useGuardianStore((s) => s.deleteAlert);
  const alerts = useGuardianStore((s) => s.alerts);
  const product = useGuardianStore((s) => s.activeProduct());
  const [name, setName] = useState(caregiver?.name ?? "");
  const [address, setAddress] = useState(caregiver?.address ?? "");

  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">Transmission sim</p>
        <h1 className="display text-3xl">Caregiver notifications</h1>
        <p className="text-sm text-amber-200">
          Simulation mode is the default. Nothing is emailed or texted. Status will never show “delivered” for a message
          that was not sent.
        </p>
      </header>
      <LabCanvas className="h-[200px]" autoRotate={false}>
        <TransmissionPulse active={alerts.length > 0} />
      </LabCanvas>
      <Panel title="Opt-in">
        <label className="text-sm">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} data-testid="caregiver-optin" />{" "}
          I understand this is a simulation and I opt in to demo alerts
        </label>
      </Panel>
      <Panel title="Contact (stored locally)">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email or SMS address (not used for sending)">
          <input className={`${inputClass} mt-2`} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Button
          className="mt-3"
          onClick={() => setCaregiver({ name, address, channel: "email" })}
        >
          Save contact
        </Button>
      </Panel>
      <Panel title="Alert preview">
        <p className="text-sm text-slate-300" data-testid="alert-preview">
          {optIn && caregiver
            ? `SIMULATED preview for ${caregiver.name}: a preference conflict on ${product?.name ?? "the active product"} would be shown here. Delivery status would remain simulated.`
            : "Save a contact and opt in to preview a simulated alert. No provider is contacted."}
        </p>
      </Panel>
      <Panel title="Trigger simulated alert">
        <Button
          disabled={!optIn || !caregiver}
          data-testid="trigger-alert"
          onClick={() => product && triggerAlert(product, "allergen.conflict")}
        >
          Simulate allergen conflict
        </Button>
        {!optIn && <p className="mt-2 text-xs text-slate-400">Opt in and save a contact first.</p>}
        <Button className="mt-2" variant="ghost" onClick={() => setOptIn(false)}>
          Disable simulation opt-in
        </Button>
      </Panel>
      <Panel title="Notification history">
        <ul className="space-y-2" data-testid="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-white/10 p-3 text-sm">
              <Badge tone="amber">{a.status}</Badge>
              <p>{a.preview}</p>
              <Button variant="danger" className="mt-2" onClick={() => deleteAlert(a.id)}>
                Delete
              </Button>
            </li>
          ))}
          {!alerts.length && <li className="text-slate-400">No simulated alerts yet.</li>}
        </ul>
      </Panel>
    </div>
  );
}
