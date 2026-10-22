"use client";

import { Select } from "antd";
import { useApi } from "@/lib/client";

export interface ProjectOption { id: string; code: string; name: string; status: string; currency: string; budgetAmount: number | null; summary?: { approved: number; remaining: number | null } }

/** Select an open project (ACTIVE / ON_HOLD). Shows code · name with remaining budget as a hint. */
export function ProjectPicker({ value, onChange, disabled, allowClear = true, placeholder = "No project" }: {
  value?: string | null; onChange?: (id: string | null) => void; disabled?: boolean; allowClear?: boolean; placeholder?: string;
}) {
  const { data } = useApi<ProjectOption[]>("/api/projects");
  return (
    <Select
      showSearch allowClear={allowClear} disabled={disabled} placeholder={placeholder} style={{ width: "100%" }}
      value={value || undefined} onChange={(v) => onChange?.(v || null)} optionFilterProp="label"
      options={(data || []).map((p) => ({
        value: p.id,
        label: `${p.code} · ${p.name}`,
        title: p.summary?.remaining != null ? `Remaining budget: ${p.currency} ${p.summary.remaining.toLocaleString()}` : undefined,
      }))}
      notFoundContent="No open projects. Create one under Projects."
    />
  );
}
