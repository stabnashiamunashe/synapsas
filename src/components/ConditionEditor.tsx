"use client";

import { Input, Select, Space, Switch } from "antd";
import type { Condition, FieldDef } from "@/lib/types";

const OPS = [
  { value: "eq", label: "equals" }, { value: "neq", label: "not equal" }, { value: "gt", label: ">" }, { value: "gte", label: "≥" },
  { value: "lt", label: "<" }, { value: "lte", label: "≤" }, { value: "in", label: "is one of (comma list)" }, { value: "contains", label: "contains" },
  { value: "empty", label: "is empty" }, { value: "notEmpty", label: "is not empty" },
];

/** Builds a Condition against the template's fields (plus table totals and priority). */
export function ConditionEditor({ fields, value, onChange, label = "Only when" }: { fields: FieldDef[]; value?: Condition | null; onChange: (c: Condition | null) => void; label?: string }) {
  const options = [
    { value: "priority", label: "Priority" },
    ...fields.filter((f) => !["heading", "divider", "file"].includes(f.type)).flatMap((f) => [
      { value: f.key, label: f.label },
      ...(f.type === "table" && f.totalColumn ? [{ value: `${f.key}Total`, label: `${f.label} total` }] : []),
    ]),
  ];
  const enabled = !!value;
  const c: Condition = value || { field: options[0]?.value || "priority", op: "gte", value: "" };
  const noValue = c.op === "empty" || c.op === "notEmpty";
  return (
    <Space wrap>
      <Switch size="small" checked={enabled} onChange={(on) => onChange(on ? c : null)} />
      <span className="muted">{label}</span>
      <Select size="small" disabled={!enabled} value={c.field} onChange={(field) => onChange({ ...c, field })} options={options} style={{ minWidth: 160 }} />
      <Select size="small" disabled={!enabled} value={c.op} onChange={(op) => onChange({ ...c, op })} options={OPS} style={{ minWidth: 150 }} />
      {!noValue && <Input size="small" disabled={!enabled} value={String(c.value ?? "")} onChange={(e) => onChange({ ...c, value: e.target.value })} placeholder="value" style={{ width: 140 }} />}
    </Space>
  );
}
