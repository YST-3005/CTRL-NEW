"use client";

import { evaluateDietaryRules } from "@/lib/dietary/rules";
import type { ProductRecord } from "@/types";
import { useGuardianStore } from "@/stores/useGuardianStore";

export function StoreWarnings({ product }: { product: ProductRecord }) {
  const prefs = useGuardianStore((s) => s.prefs);
  const findings = evaluateDietaryRules(product, prefs).filter((f) => f.severity !== "info");
  if (!findings.length) {
    return <p className="mt-2 text-xs text-emerald-300">No configured conflict on disclosed fields.</p>;
  }
  return (
    <ul className="mt-2 space-y-1" data-testid={`store-warnings-${product.id}`}>
      {findings.map((f) => (
        <li key={f.id} className="text-xs text-rose-300">
          {f.title}: {f.detail}
        </li>
      ))}
    </ul>
  );
}
