"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { STOREFRONT_PRODUCTS } from "@/data/samples";
import { Panel } from "@/components/ui/Hud";

export default function StoreDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const item = STOREFRONT_PRODUCTS.find((p) => p.slug === slug);
  if (!item) return <p>Unknown demo SKU.</p>;
  const p = item.product;
  return (
    <Panel title={p.name}>
      <article
        data-llg-product
        data-llg-id={p.id}
        data-llg-name={p.name}
        data-llg-ingredients={p.ingredients.map((i) => i.originalText).join(", ")}
        data-llg-allergens={(p.allergenStatement?.allergens ?? []).join(",")}
        data-llg-vegan={p.dietary.veganStatus}
      >
        <p className="text-slate-400">{p.brand}</p>
        <p className="mt-2">{p.description}</p>
        <p className="mt-3 text-sm">Ingredients: {p.ingredients.map((i) => i.originalText).join(", ")}</p>
        <p className="mt-2 text-sm">{p.allergenStatement?.text}</p>
        <Link href="/analysis" className="mt-4 inline-block text-cyan-300">
          Open full LabelLens analysis
        </Link>
      </article>
    </Panel>
  );
}
