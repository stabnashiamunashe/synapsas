"use client";

import { Descriptions, Divider, Typography } from "antd";
import type { FieldDef } from "@/lib/types";
import { TableField } from "./TableField";
import { formatMoney, useApi } from "@/lib/client";
import { evaluateCondition } from "@/lib/formula";

/** Read-only rendering of submitted form data according to the template snapshot. */
export function DataView({ fields, data, currency = "USD" }: { fields: FieldDef[]; data: Record<string, unknown>; currency?: string }) {
  const { data: users } = useApi<{ id: string; name: string }[]>(fields.some((f) => f.type === "user") ? "/api/users?all=1" : null);
  const { data: departments } = useApi<{ id: string; name: string }[]>(fields.some((f) => f.type === "department") ? "/api/departments" : null);
  const groups: React.ReactNode[] = [];
  let items: { key: string; label: string; children: React.ReactNode; span?: number | "filled" }[] = [];
  const flush = () => {
    if (items.length) groups.push(<Descriptions key={`d${groups.length}`} bordered size="small" column={{ xs: 1, sm: 2 }} items={items} style={{ marginBottom: 16 }} />);
    items = [];
  };
  for (const f of fields) {
    if (f.visibleWhen && !evaluateCondition(f.visibleWhen, data)) continue;
    if (f.type === "heading") { flush(); groups.push(<Typography.Title level={5} key={f.key}>{f.label}</Typography.Title>); continue; }
    if (f.type === "divider") { flush(); groups.push(<Divider key={f.key} />); continue; }
    if (f.type === "file") continue;
    const v = data[f.key];
    if (f.type === "table") {
      flush();
      groups.push(
        <div key={f.key} style={{ marginBottom: 16 }}>
          <Typography.Text strong>{f.label}</Typography.Text>
          <div style={{ marginTop: 8 }}><TableField field={f} value={(v as Record<string, unknown>[]) || []} currency={currency} disabled /></div>
        </div>,
      );
      continue;
    }
    let text: React.ReactNode = "";
    if (v === undefined || v === null || v === "") text = <span className="muted">–</span>;
    else if (f.type === "currency") text = <span className="mono">{formatMoney(v, currency)}</span>;
    else if (f.type === "checkbox") text = v ? "Yes" : "No";
    else if (f.type === "user") text = users?.find((u) => u.id === v)?.name || String(v);
    else if (f.type === "department") text = departments?.find((d) => d.id === v)?.name || String(v);
    else if (Array.isArray(v)) text = v.join(", ");
    else if (f.type === "textarea" || f.type === "richtext") text = <div style={{ whiteSpace: "pre-wrap" }}>{String(v)}</div>;
    else text = String(v);
    items.push({ key: f.key, label: f.label, children: text, span: f.type === "textarea" || f.type === "richtext" ? "filled" : 1 });
  }
  flush();
  return <>{groups}</>;
}
