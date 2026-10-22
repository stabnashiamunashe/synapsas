"use client";

import { Button, Checkbox, DatePicker, Input, InputNumber, Select, Table, Tooltip, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { columnSum, computeRows } from "@/lib/formula";
import type { FieldDef } from "@/lib/types";
import { formatMoney } from "@/lib/client";

type Row = Record<string, unknown>;

/** Editable line-item table driven by a FieldDef with `columns`. Value is an array of row objects. */
export function TableField({ field, value, onChange, currency = "USD", disabled }: {
  field: FieldDef; value?: Row[]; onChange?: (rows: Row[]) => void; currency?: string; disabled?: boolean;
}) {
  const columns = field.columns || [];
  const rows = computeRows(columns, value || []);
  const update = (next: Row[]) => onChange?.(computeRows(columns, next));
  const setCell = (i: number, key: string, v: unknown) => update(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const addRow = () => {
    if (field.maxRows && rows.length >= field.maxRows) return;
    const blank: Row = {};
    columns.forEach((c) => {
      blank[c.key] = c.type === "checkbox" ? false : c.type === "number" || c.type === "currency" ? undefined : "";
    });
    update([...rows, blank]);
  };
  const removeRow = (i: number) => update(rows.filter((_, idx) => idx !== i));

  return (
    <div>
      <Table<Row>
        size="small"
        pagination={false}
        rowKey="__i"
        dataSource={rows.map((r, i) => ({ ...r, __i: i }))}
        scroll={{ x: true }}
        columns={[
          { title: "#", width: 40, render: (_, __, i) => i + 1 },
          ...columns.map((c) => ({
            title: <span>{c.label}{c.required && <span style={{ color: "#ff4d4f" }}> *</span>}{c.type === "computed" && <Tooltip title={`= ${c.formula}`}><span className="muted"> ƒ</span></Tooltip>}</span>,
            key: c.key,
            width: c.width,
            render: (_: unknown, row: Row, i: number) => {
              const v = row[c.key];
              if (disabled || c.type === "computed") {
                if (c.type === "currency" || c.type === "computed") return <span className="mono">{formatMoney(v, currency)}</span>;
                if (c.type === "checkbox") return v ? "Yes" : "No";
                return <span>{String(v ?? "")}</span>;
              }
              switch (c.type) {
                case "number":
                  return <InputNumber value={v as number | undefined} onChange={(n) => setCell(i, c.key, n ?? undefined)} style={{ width: "100%" }} placeholder="0" />;
                case "currency":
                  return <InputNumber value={v as number | undefined} onChange={(n) => setCell(i, c.key, n ?? undefined)} style={{ width: "100%" }} min={0} precision={2} placeholder="0.00" />;
                case "select":
                  return <Select value={(v as string) || undefined} onChange={(s) => setCell(i, c.key, s)} options={(c.options || []).map((o) => ({ value: o, label: o }))} style={{ width: "100%" }} />;
                case "date":
                  return <DatePicker value={v ? dayjs(v as string) : null} onChange={(d) => setCell(i, c.key, d ? d.format("YYYY-MM-DD") : "")} style={{ width: "100%" }} />;
                case "checkbox":
                  return <Checkbox checked={!!v} onChange={(e) => setCell(i, c.key, e.target.checked)} />;
                default:
                  return <Input value={(v as string) || ""} onChange={(e) => setCell(i, c.key, e.target.value)} />;
              }
            },
          })),
          ...(disabled ? [] : [{ title: "", width: 40, render: (_: unknown, __: Row, i: number) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRow(i)} /> }]),
        ]}
        summary={() => {
          const sums = columns.filter((c) => c.sum || c.key === field.totalColumn);
          if (!sums.length || !rows.length) return null;
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} />
              {columns.map((c, idx) => (
                <Table.Summary.Cell index={idx + 1} key={c.key}>
                  {sums.includes(c) ? <Typography.Text strong className="mono">{c.type === "currency" || c.type === "computed" ? formatMoney(columnSum(rows, c.key), currency) : columnSum(rows, c.key)}</Typography.Text> : null}
                </Table.Summary.Cell>
              ))}
              {!disabled && <Table.Summary.Cell index={columns.length + 1} />}
            </Table.Summary.Row>
          );
        }}
      />
      {!disabled && (
        <Button type="dashed" icon={<PlusOutlined />} onClick={addRow} style={{ marginTop: 8 }} block disabled={!!field.maxRows && rows.length >= field.maxRows}>
          Add row
        </Button>
      )}
    </div>
  );
}
