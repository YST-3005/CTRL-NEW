import type { CaregiverAlert, CaregiverContact, ProductRecord } from "@/types";
import { nowIso, uid } from "@/lib/utils";

export function canSimulateAlert(optIn: boolean, contact: CaregiverContact | null): boolean {
  return Boolean(optIn && contact?.name && contact?.address);
}

export function buildSimulatedAlert(product: ProductRecord, rule: string): CaregiverAlert {
  return {
    id: uid("alert"),
    rule,
    productName: product.name,
    preview: `SIMULATED: ${product.name} matched rule “${rule}”. No message was sent.`,
    status: "simulated",
    simulated: true,
    createdAt: nowIso(),
  };
}
