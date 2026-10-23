"use client";

import useSWR, { type SWRConfiguration } from "swr";

export class ClientError extends Error {
  status: number;
  details?: { path: string; message: string }[];
  constructor(status: number, message: string, details?: { path: string; message: string }[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  const text = await res.text();
  let body: { ok: boolean; data?: T; error?: string; details?: { path: string; message: string }[] } | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok || !body?.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ClientError(res.status, body?.error || res.statusText || "Request failed", body?.details);
  }
  return body.data as T;
}

const fetcher = <T,>(url: string) => api<T>(url);

export function useApi<T = unknown>(url: string | null, config?: SWRConfiguration) {
  return useSWR<T>(url, fetcher as (u: string) => Promise<T>, { revalidateOnFocus: false, ...config });
}

export interface MeResponse {
  user: {
    id: string; name: string; email: string; role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER"; jobTitle?: string | null;
    avatarUrl?: string | null; departmentId?: string | null; department?: { id: string; name: string } | null;
    manager?: { id: string; name: string } | null;
    twoFactorEnabled: boolean; forcePasswordChange: boolean; lastLoginAt?: string | null; lastLoginIp?: string | null;
    passwordChangedAt?: string | null; backupCodesLeft: number; prefs: import("@/lib/types").NotificationPrefs;
  };
  org: {
    id: string; name: string; slug: string; plan: string; customDomain?: string | null;
    branding: import("@/lib/types").BrandingSettings; settings: import("@/lib/types").OrgSettings;
    limits: import("@/lib/plans").PlanLimits;
  };
  unread: number;
  pendingApprovals: number;
  recentNotifications: { id: string; title: string; body?: string | null; link?: string | null; type: string; readAt?: string | null; createdAt: string }[];
  security: { mustChangePassword: boolean; mustSetup2fa: boolean };
}

export function useMe() {
  return useApi<MeResponse>("/api/auth/me", { refreshInterval: 60000 });
}

export function formatMoney(v: unknown, currency = "USD") {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export function formatDate(v?: string | Date | null, withTime = false) {
  if (!v) return "";
  const d = new Date(v);
  return withTime ? d.toLocaleString() : d.toLocaleDateString();
}

export function timeAgo(v?: string | Date | null) {
  if (!v) return "";
  const diff = (Date.now() - new Date(v).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(v).toLocaleDateString();
}

export function downloadUrl(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
