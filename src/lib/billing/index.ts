// Single-organisation edition: there are no subscriptions. This shim keeps the route handlers' plan checks
// compiling while always granting the full feature set. The multi-tenant SaaS build lives on the `billing` branch.
type Plan = "FREE" | "STARTER" | "BUSINESS" | "ENTERPRISE";

export type OrgBilling = { plan?: string | null; planStatus?: string | null };

export interface Entitlements {
  plan: Plan;
  subscribedPlan: Plan;
  status: "ACTIVE";
  locked: boolean;
  trialDaysLeft: null;
  graceDaysLeft: null;
  renewsAt: null;
  banner: null;
}

export function entitlementsFor(_org?: OrgBilling): Entitlements {
  return { plan: "ENTERPRISE", subscribedPlan: "ENTERPRISE", status: "ACTIVE", locked: false, trialDaysLeft: null, graceDaysLeft: null, renewsAt: null, banner: null };
}

export function effectivePlan(_org?: OrgBilling): Plan {
  return "ENTERPRISE";
}

export async function orgEntitlements(_orgId: string) {
  return entitlementsFor();
}

/** Defaults applied when the organisation row is created. */
export function trialDefaults() {
  return { plan: "ENTERPRISE", planStatus: "ACTIVE" as const };
}

export const billingSelect = { plan: true, planStatus: true } as const;
