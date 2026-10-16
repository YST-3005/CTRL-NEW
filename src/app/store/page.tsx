"use client";

import Link from "next/link";
import { STOREFRONT_PRODUCTS } from "@/data/samples";
import { Panel } from "@/components/ui/Hud";
import { StoreWarnings } from "@/components/store/StoreWarnings";

export default function StorePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">Mock grocery · extension target</p>
        <h1 className="display text-3xl">Helion Market</h1>
        <p className="text-sm text-slate-400">
          Local demonstration storefront only. The Chrome extension reads <code>data-llg-*</code> attributes on these
          cards. It does not work on arbitrary shopping sites.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {STOREFRONT_PRODUCTS.map((item) => (
          <Panel key={item.slug}>
            <article
              data-llg-product
              data-llg-id={item.product.id}
              data-llg-name={item.product.name}
              data-llg-ingredients={item.product.ingredients.map((i) => i.originalText).join(", ")}
              data-llg-allergens={(item.product.allergenStatement?.allergens ?? []).join(",")}
              data-llg-vegan={item.product.dietary.veganStatus}
            >
              <h2 className="text-xl">{item.name}</h2>
              <p className="text-sm text-slate-400">{item.brand}</p>
              <p className="mt-2 text-cyan-200">${item.price}</p>
              <StoreWarnings product={item.product} />
              <Link className="mt-3 inline-block text-sm text-cyan-300" href={`/store/${item.slug}`}>
                Product detail
              </Link>
            </article>
          </Panel>
        ))}
      </div>
      <Panel title="Load unpacked extension">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>Open Chrome → chrome://extensions</li>
          <li>Enable Developer mode</li>
          <li>Load unpacked → select the <code>extension/</code> folder in this repo</li>
          <li>Open this page and confirm warning chips on conflicting products</li>
        </ol>
      </Panel>
    </div>
  );
}
