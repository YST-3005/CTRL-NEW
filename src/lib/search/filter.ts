import type { ProductRecord, ScanRecord, VeganStatus } from "@/types";
import { normalizeName } from "@/lib/utils";

export interface CatalogFilters {
  query: string;
  vegan?: VeganStatus | "";
  allergen?: string;
  savedOnly?: boolean;
  status?: string;
  fromDate?: string;
  toDate?: string;
  completenessMin?: number;
  sort: "name" | "date" | "completeness";
}

export function filterProducts(
  products: ProductRecord[],
  f: CatalogFilters,
  savedIds: Set<string> = new Set(),
): ProductRecord[] {
  const q = normalizeName(f.query);
  let list = products.filter((p) => {
    const text = `${p.name} ${p.brand} ${p.ingredients.map((i) => i.name).join(" ")}`;
    if (q && !normalizeName(text).includes(q)) return false;
    if (f.vegan && p.dietary.veganStatus !== f.vegan) return false;
    if (f.allergen) {
      const a = normalizeName(f.allergen);
      const hit =
        p.allergenStatement?.allergens.some((x) => normalizeName(x) === a) ||
        p.ingredients.some((i) => i.allergenTags.some((t) => normalizeName(t) === a));
      if (!hit) return false;
    }
    if (f.savedOnly && !savedIds.has(p.id)) return false;
    if (f.completenessMin && p.completeness < f.completenessMin) return false;
    return true;
  });
  if (f.sort === "name") list = list.sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === "completeness") list = list.sort((a, b) => b.completeness - a.completeness);
  if (f.sort === "date") list = list.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  return list;
}

export function filterScans(scans: ScanRecord[], f: CatalogFilters): ScanRecord[] {
  const products = filterProducts(
    scans.map((s) => s.product),
    { ...f, savedOnly: false },
    new Set(),
  );
  const ids = new Set(products.map((p) => p.id));
  return scans.filter((s) => {
    if (!ids.has(s.product.id) && f.query) {
      if (!normalizeName(s.product.name).includes(normalizeName(f.query))) return false;
    }
    if (f.savedOnly && !s.saved) return false;
    if (f.status && s.phase !== f.status) return false;
    if (f.fromDate && s.createdAt < f.fromDate) return false;
    if (f.toDate && s.createdAt > f.toDate) return false;
    if (f.query && !ids.has(s.product.id)) return false;
    return true;
  });
}
