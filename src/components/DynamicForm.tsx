"use client";

import { Checkbox, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Select, Typography } from "antd";
import dayjs from "dayjs";
import { evaluateCondition } from "@/lib/formula";
import type { FieldDef } from "@/lib/types";
import { TableField } from "./TableField";
import { useApi } from "@/lib/client";

const span = (w?: FieldDef["width"]) => (w === "half" ? 12 : w === "third" ? 8 : 24);

/** Renders template fields inside an antd Form. Values are stored in the form under each field key. */
export function DynamicFields({ fields, currency = "USD", disabled }: { fields: FieldDef[]; currency?: string; disabled?: boolean }) {
  const form = Form.useFormInstance();
  const values = Form.useWatch([], form) || {};
  const { data: users } = useApi<{ id: string; name: string; email: string }[]>(fields.some((f) => f.type === "user") ? "/api/users" : null);
  const { data: departments } = useApi<{ id: string; name: string }[]>(fields.some((f) => f.type === "department") ? "/api/departments" : null);

  return (
    <Row gutter={16}>
      {fields.map((f) => {
        if (f.visibleWhen && !evaluateCondition(f.visibleWhen, values)) return null;
        if (f.type === "heading") return <Col span={24} key={f.key}><Typography.Title level={5} style={{ marginTop: 8 }}>{f.label}</Typography.Title>{f.helpText && <Typography.Paragraph type="secondary">{f.helpText}</Typography.Paragraph>}</Col>;
        if (f.type === "divider") return <Col span={24} key={f.key}><Divider /></Col>;
        const rules = f.required ? [{ required: true, message: `${f.label} is required` }] : [];
        const common = { name: f.key, label: f.label, rules, extra: f.helpText };
        let control: React.ReactNode;
        let valuePropName: string | undefined;
        let getValueProps: ((v: unknown) => { value: unknown }) | undefined;
        let normalize: ((v: unknown) => unknown) | undefined;
        switch (f.type) {
          case "textarea": control = <Input.TextArea rows={4} placeholder={f.placeholder} disabled={disabled} />; break;
          case "richtext": control = <Input.TextArea rows={8} placeholder={f.placeholder} disabled={disabled} />; break;
          case "number": control = <InputNumber style={{ width: "100%" }} min={f.min} max={f.max} placeholder={f.placeholder} disabled={disabled} />; break;
          case "currency": control = <InputNumber style={{ width: "100%" }} min={f.min ?? 0} max={f.max} precision={2} prefix={currency} placeholder={f.placeholder} disabled={disabled} />; break;
          case "date":
            control = <DatePicker style={{ width: "100%" }} disabled={disabled} />;
            getValueProps = (v) => ({ value: v ? dayjs(v as string) : null });
            normalize = (v) => (v ? (v as dayjs.Dayjs).format("YYYY-MM-DD") : null);
            break;
          case "daterange":
            control = <DatePicker.RangePicker style={{ width: "100%" }} disabled={disabled} />;
            getValueProps = (v) => ({ value: Array.isArray(v) && v.length === 2 && v[0] ? [dayjs(v[0]), dayjs(v[1])] : null });
            normalize = (v) => (Array.isArray(v) && v[0] ? [(v[0] as dayjs.Dayjs).format("YYYY-MM-DD"), (v[1] as dayjs.Dayjs).format("YYYY-MM-DD")] : null);
            break;
          case "select": control = <Select placeholder={f.placeholder || "Select"} options={(f.options || []).map((o) => ({ value: o, label: o }))} disabled={disabled} allowClear />; break;
          case "multiselect": control = <Select mode="multiple" placeholder={f.placeholder || "Select"} options={(f.options || []).map((o) => ({ value: o, label: o }))} disabled={disabled} />; break;
          case "checkbox": control = <Checkbox disabled={disabled}>{f.placeholder || f.label}</Checkbox>; valuePropName = "checked"; break;
          case "user": control = <Select showSearch optionFilterProp="label" placeholder="Choose a person" options={(users || []).map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))} disabled={disabled} allowClear />; break;
          case "department": control = <Select placeholder="Choose a department" options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} disabled={disabled} allowClear />; break;
          case "table":
            return (
              <Col span={24} key={f.key}>
                <Form.Item {...common} rules={f.required ? [{ required: true, validator: (_, v) => (Array.isArray(v) && v.length ? Promise.resolve() : Promise.reject(new Error(`${f.label} needs at least one row`))) }] : []}>
                  <TableField field={f} currency={currency} disabled={disabled} />
                </Form.Item>
              </Col>
            );
          case "file":
            return <Col span={24} key={f.key}><Form.Item label={f.label} extra={f.helpText || "Use the Attachments panel to upload files for this request."}><Input disabled placeholder="Attach via the Attachments panel" /></Form.Item></Col>;
          default: control = <Input placeholder={f.placeholder} disabled={disabled} />;
        }
        return (
          <Col xs={24} md={span(f.width)} key={f.key}>
            <Form.Item {...common} valuePropName={valuePropName} getValueProps={getValueProps} normalize={normalize}>{control}</Form.Item>
          </Col>
        );
      })}
    </Row>
  );
}

/** Default values from a template. */
export function defaultsFor(fields: FieldDef[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
    else if (f.type === "table") out[f.key] = [];
    else if (f.type === "checkbox") out[f.key] = false;
  }
  return out;
}
