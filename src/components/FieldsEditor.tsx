"use client";

import { Button, Card, Checkbox, Col, Divider, Empty, Input, InputNumber, Row, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { ColumnType, FieldDef, FieldType, TableColumnDef } from "@/lib/types";
import { ConditionEditor } from "./ConditionEditor";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" }, { value: "textarea", label: "Paragraph" }, { value: "richtext", label: "Long text / memo body" },
  { value: "number", label: "Number" }, { value: "currency", label: "Currency amount" }, { value: "date", label: "Date" }, { value: "daterange", label: "Date range" },
  { value: "select", label: "Dropdown" }, { value: "multiselect", label: "Multi-select" }, { value: "checkbox", label: "Checkbox" },
  { value: "user", label: "Person picker" }, { value: "department", label: "Department picker" }, { value: "table", label: "Line items table (custom rows)" },
  { value: "file", label: "File note" }, { value: "heading", label: "Section heading" }, { value: "divider", label: "Divider" },
];
const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" }, { value: "number", label: "Number" }, { value: "currency", label: "Currency" }, { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" }, { value: "checkbox", label: "Checkbox" }, { value: "computed", label: "Computed (formula)" },
];

const keyFrom = (label: string, existing: string[]) => {
  let base = label.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^[0-9]+/, "");
  base = base ? base[0].toLowerCase() + base.slice(1) : "field";
  let k = base, i = 2;
  while (existing.includes(k)) k = `${base}${i++}`;
  return k;
};

export function FieldsEditor({ fields, onChange }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void }) {
  const [selected, setSelected] = useState<number>(0);
  const f = fields[selected];
  const update = (patch: Partial<FieldDef>) => onChange(fields.map((x, i) => (i === selected ? { ...x, ...patch } : x)));
  const add = (type: FieldType = "text") => {
    const label = type === "table" ? "Items" : type === "heading" ? "Section" : FIELD_TYPES.find((t) => t.value === type)?.label || "Field";
    const nf: FieldDef = { key: keyFrom(label, fields.map((x) => x.key)), label, type, required: false, width: type === "table" || type === "textarea" || type === "richtext" || type === "heading" ? "full" : "half" };
    if (type === "table") {
      nf.columns = [
        { key: "description", label: "Description", type: "text", required: true },
        { key: "quantity", label: "Qty", type: "number", required: true, width: 90 },
        { key: "unitPrice", label: "Unit price", type: "currency", required: true, width: 130 },
        { key: "total", label: "Total", type: "computed", formula: "quantity * unitPrice", sum: true, width: 130 },
      ];
      nf.totalColumn = "total";
      nf.minRows = 1;
    }
    onChange([...fields, nf]);
    setSelected(fields.length);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setSelected(j);
  };
  const remove = (i: number) => { onChange(fields.filter((_, idx) => idx !== i)); setSelected(Math.max(0, i - 1)); };

  const cols = f?.columns || [];
  const setCols = (c: TableColumnDef[]) => update({ columns: c });

  return (
    <Row gutter={16}>
      <Col xs={24} md={10}>
        <Space style={{ marginBottom: 8 }} wrap>
          <Select<FieldType | undefined> placeholder="Add field…" style={{ width: 240 }} value={undefined} options={FIELD_TYPES} onChange={(t) => t && add(t)} />
          <Button icon={<PlusOutlined />} onClick={() => add("table")}>Add line items</Button>
        </Space>
        {fields.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No fields yet. Add one to start." />}
        {fields.map((x, i) => (
          <div key={i} className={`field-card ${i === selected ? "selected" : ""}`} onClick={() => setSelected(i)} style={{ cursor: "pointer" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Typography.Text strong ellipsis>{x.label}</Typography.Text>
                {x.required && <span style={{ color: "#ff4d4f" }}>*</span>}
              </div>
              <div className="muted" style={{ fontSize: 12 }}><Tag style={{ marginInlineEnd: 4 }}>{FIELD_TYPES.find((t) => t.value === x.type)?.label}</Tag><span className="mono">{x.key}</span></div>
            </div>
            <Space size={0}>
              <Button type="text" size="small" icon={<ArrowUpOutlined />} onClick={(e) => { e.stopPropagation(); move(i, -1); }} />
              <Button type="text" size="small" icon={<ArrowDownOutlined />} onClick={(e) => { e.stopPropagation(); move(i, 1); }} />
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); remove(i); }} />
            </Space>
          </div>
        ))}
      </Col>
      <Col xs={24} md={14}>
        {!f ? <Card><Typography.Text type="secondary">Select a field to edit its settings.</Typography.Text></Card> : (
          <Card title={`Field settings · ${f.label}`} size="small">
            <Row gutter={12}>
              <Col xs={24} md={12}><label className="muted">Label</label><Input value={f.label} onChange={(e) => update({ label: e.target.value })} /></Col>
              <Col xs={24} md={12}><label className="muted">Key (used in conditions & titles)</label><Input className="mono" value={f.key} onChange={(e) => update({ key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })} /></Col>
              <Col xs={24} md={12} style={{ marginTop: 10 }}><label className="muted">Type</label><Select style={{ width: "100%" }} value={f.type} options={FIELD_TYPES} onChange={(type) => update({ type })} /></Col>
              <Col xs={24} md={12} style={{ marginTop: 10 }}><label className="muted">Width</label><Select style={{ width: "100%" }} value={f.width || "full"} options={[{ value: "full", label: "Full" }, { value: "half", label: "Half" }, { value: "third", label: "Third" }]} onChange={(width) => update({ width })} /></Col>
              <Col span={24} style={{ marginTop: 10 }}><label className="muted">Help text</label><Input value={f.helpText || ""} onChange={(e) => update({ helpText: e.target.value })} /></Col>
              <Col span={24} style={{ marginTop: 10 }}><label className="muted">Placeholder</label><Input value={f.placeholder || ""} onChange={(e) => update({ placeholder: e.target.value })} /></Col>
              {(f.type === "select" || f.type === "multiselect") && (
                <Col span={24} style={{ marginTop: 10 }}><label className="muted">Options (one per line)</label><Input.TextArea rows={3} value={(f.options || []).join("\n")} onChange={(e) => update({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} /></Col>
              )}
              {(f.type === "number" || f.type === "currency") && (
                <>
                  <Col xs={24} md={12} style={{ marginTop: 10 }}><label className="muted">Min</label><InputNumber style={{ width: "100%" }} value={f.min} onChange={(v) => update({ min: v ?? undefined })} /></Col>
                  <Col xs={24} md={12} style={{ marginTop: 10 }}><label className="muted">Max</label><InputNumber style={{ width: "100%" }} value={f.max} onChange={(v) => update({ max: v ?? undefined })} /></Col>
                </>
              )}
              <Col span={24} style={{ marginTop: 12 }}>
                <Space size="large" wrap>
                  <span><Switch size="small" checked={!!f.required} onChange={(required) => update({ required })} /> Required</span>
                </Space>
              </Col>
              <Col span={24} style={{ marginTop: 12 }}>
                <ConditionEditor label="Show only when" fields={fields.filter((x) => x.key !== f.key)} value={f.visibleWhen || null} onChange={(visibleWhen) => update({ visibleWhen: visibleWhen || undefined })} />
              </Col>
            </Row>

            {f.type === "table" && (
              <>
                <Divider>Columns (the rows users add follow this layout)</Divider>
                <Table<TableColumnDef> size="small" pagination={false} rowKey="key" dataSource={cols} scroll={{ x: true }}
                  columns={[
                    { title: "Label", render: (_, c, i) => <Input size="small" value={c.label} onChange={(e) => setCols(cols.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} /> },
                    { title: "Key", width: 120, render: (_, c, i) => <Input size="small" className="mono" value={c.key} onChange={(e) => setCols(cols.map((x, idx) => (idx === i ? { ...x, key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") } : x)))} /> },
                    { title: "Type", width: 150, render: (_, c, i) => <Select size="small" style={{ width: "100%" }} value={c.type} options={COLUMN_TYPES} onChange={(type) => setCols(cols.map((x, idx) => (idx === i ? { ...x, type } : x)))} /> },
                    { title: "Formula / options", width: 200, render: (_, c, i) => c.type === "computed"
                      ? <Input size="small" className="mono" placeholder="quantity * unitPrice" value={c.formula || ""} onChange={(e) => setCols(cols.map((x, idx) => (idx === i ? { ...x, formula: e.target.value } : x)))} />
                      : c.type === "select" ? <Input size="small" placeholder="A, B, C" value={(c.options || []).join(", ")} onChange={(e) => setCols(cols.map((x, idx) => (idx === i ? { ...x, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))} /> : null },
                    { title: "Req.", width: 60, render: (_, c, i) => <Checkbox checked={!!c.required} disabled={c.type === "computed"} onChange={(e) => setCols(cols.map((x, idx) => (idx === i ? { ...x, required: e.target.checked } : x)))} /> },
                    { title: "Sum", width: 60, render: (_, c, i) => <Checkbox checked={!!c.sum} onChange={(e) => setCols(cols.map((x, idx) => (idx === i ? { ...x, sum: e.target.checked } : x)))} /> },
                    { title: "", width: 40, render: (_, __, i) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setCols(cols.filter((_, idx) => idx !== i))} /> },
                  ]} />
                <Space style={{ marginTop: 8 }} wrap>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setCols([...cols, { key: keyFrom("column", cols.map((c) => c.key)), label: "Column", type: "text" }])}>Add column</Button>
                  <span className="muted">Total column (drives conditions like “total ≥ 5000”):</span>
                  <Select size="small" allowClear style={{ width: 160 }} value={f.totalColumn} options={cols.filter((c) => ["number", "currency", "computed"].includes(c.type)).map((c) => ({ value: c.key, label: c.label }))} onChange={(totalColumn) => update({ totalColumn })} />
                  <span className="muted">Min rows</span><InputNumber size="small" min={0} value={f.minRows} onChange={(v) => update({ minRows: v ?? undefined })} />
                  <span className="muted">Max rows</span><InputNumber size="small" min={1} value={f.maxRows} onChange={(v) => update({ maxRows: v ?? undefined })} />
                </Space>
              </>
            )}
          </Card>
        )}
      </Col>
    </Row>
  );
}
