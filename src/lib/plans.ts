import type { Plan } from "./types";

/** New workspaces get this plan free for TRIAL_DAYS, then fall back to FREE unless they subscribe. */
export const TRIAL_PLAN: Plan = "BUSINESS";
export const TRIAL_DAYS = 14;
/** Days a PAST_DUE workspace keeps full access before becoming read-only. */
export const GRACE_DAYS = 7;
/** Yearly price = 10 months. */
export const YEARLY_MONTHS = 10;

export interface PlanLimits {
  name: string;
  priceMonthly: number;
  users: number; // -1 = unlimited
  templates: number;
  requestsPerMonth: number;
  storageMb: number;
  apiAccess: boolean;
  webhooks: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  auditRetentionDays: number;
  sso: boolean;
}

export const PLANS: Record<Plan, PlanLimits> = {
  FREE: {
    name: "Free",
    priceMonthly: 0,
    users: 5,
    templates: 3,
    requestsPerMonth: 50,
    storageMb: 100,
    apiAccess: false,
    webhooks: false,
    customDomain: false,
    whiteLabel: false,
    auditRetentionDays: 30,
    sso: false,
  },
  STARTER: {
    name: "Starter",
    priceMonthly: 29,
    users: 25,
    templates: 10,
    requestsPerMonth: 500,
    storageMb: 2048,
    apiAccess: true,
    webhooks: false,
    customDomain: false,
    whiteLabel: true,
    auditRetentionDays: 90,
    sso: false,
  },
  BUSINESS: {
    name: "Business",
    priceMonthly: 99,
    users: 100,
    templates: 50,
    requestsPerMonth: 5000,
    storageMb: 20480,
    apiAccess: true,
    webhooks: true,
    customDomain: true,
    whiteLabel: true,
    auditRetentionDays: 365,
    sso: true,
  },
  ENTERPRISE: {
    name: "Enterprise",
    priceMonthly: 299,
    users: -1,
    templates: -1,
    requestsPerMonth: -1,
    storageMb: 102400,
    apiAccess: true,
    webhooks: true,
    customDomain: true,
    whiteLabel: true,
    auditRetentionDays: 1825,
    sso: true,
  },
};

export function limitsFor(plan: string): PlanLimits {
  return PLANS[(plan as Plan) in PLANS ? (plan as Plan) : "FREE"];
}

export function withinLimit(limit: number, current: number) {
  return limit === -1 || current < limit;
}
