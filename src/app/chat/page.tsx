"use client";

import { FormEvent, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Badge, Button, Panel, inputClass } from "@/components/ui/Hud";
import { AssistantOrb } from "@/components/three/LabCanvas";

const MotionDiv = motion.div as any;

const LabCanvas = dynamic(() => import("@/components/three/LabCanvas").then((m) => m.LabCanvas), { ssr: false });

export default function ChatPage() {
  const product = useGuardianStore((s) => s.activeProduct());
  const chat = useGuardianStore((s) => s.chat);
  const busy = useGuardianStore((s) => s.chatBusy);
  const sendChat = useGuardianStore((s) => s.sendChat);
  const selectIngredient = useGuardianStore((s) => s.selectIngredient);
  const selected = useGuardianStore((s) => s.selectedIngredientId);
  const [q, setQ] = useState("Does this product contain added sugar?");
  const [drawer, setDrawer] = useState(true);

  const lastAssistant = [...chat].reverse().find((m) => m.role === "assistant");
  const highlighted = useMemo(() => {
    if (!product || !lastAssistant) return [];
    return product.ingredients.filter((i) => lastAssistant.content.toLowerCase().includes(i.originalText.toLowerCase()));
  }, [product, lastAssistant]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = q;
    setQ("");
    await sendChat(text);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Panel kicker="Ask Your Label" title={product ? product.name : "No product selected"}>
        <p className="mb-3 text-xs text-amber-200">
          Grounded local engine is active. An LLM provider is used only if OPENAI_API_KEY is set on the server. Not medical
          advice.
        </p>
        <div className="max-h-[480px] space-y-3 overflow-y-auto" data-testid="chat-log">
          {chat.map((m) => (
            <MotionDiv
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "ml-8 bg-violet-500/15" : "mr-8 bg-cyan-400/10"}`}
            >
              <p className="hud-label">{m.role}</p>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.educationalOnly && <Badge tone="muted">educational, not a diagnosis</Badge>}
              {m.unknown && <Badge tone="amber">unknown / incomplete</Badge>}
              {m.sources.length > 0 && (
                <ul className="mt-2 text-xs text-slate-400">
                  {m.sources.map((s) => (
                    <li key={s.id}>
                      {s.kind}: {s.sourceText || s.claim}
                    </li>
                  ))}
                </ul>
              )}
            </MotionDiv>
          ))}
          {busy && <p className="text-cyan-300">Consulting label evidence…</p>}
        </div>
        {highlighted.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {highlighted.map((i) => (
              <button
                key={i.id}
                className={`rounded-full border px-3 py-1 text-xs ${selected === i.id ? "border-cyan-300 text-cyan-100" : "border-white/15"}`}
                onClick={() => selectIngredient(i.id)}
              >
                {i.originalText}
              </button>
            ))}
          </div>
        )}
        <form className="mt-4 flex gap-2" onSubmit={onSubmit}>
          <input
            className={inputClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Question"
            data-testid="chat-input"
          />
          <Button type="submit" disabled={busy || !q.trim()}>
            Send
          </Button>
        </form>
      </Panel>
      <div className="space-y-4">
        <LabCanvas className="h-[220px]" autoRotate={false}>
          <AssistantOrb thinking={busy} />
        </LabCanvas>
        <Panel title="Evidence drawer">
          <Button variant="ghost" className="mb-3" onClick={() => setDrawer((v) => !v)}>
            {drawer ? "Collapse" : "Expand"}
          </Button>
          {drawer && (
            <>
              <p className="text-sm text-slate-300">{product?.dietary.veganSummary}</p>
              <ul className="mt-3 list-disc pl-4 text-sm text-slate-400">
                {product?.missingInformation.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
