"use client";

import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Switch, Tabs, Typography } from "antd";
import { ArrowLeftOutlined, EyeOutlined, SaveOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useMe } from "@/lib/client";
import { CATEGORY_LABELS, type FieldDef, type LevelDef, type TemplateCategory, type TemplateSettings } from "@/lib/types";
import { FieldsEditor } from "./FieldsEditor";
import { LevelsEditor } from "./LevelsEditor";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { BranchesOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { DynamicFields, defaultsFor } from "./DynamicForm";
import { costFieldOptions } from "@/lib/cost";

export interface TemplateModel {
  id?: string; name: string; description?: string | null; category: TemplateCategory; icon?: string | null; color?: string | null; prefix: string;
  fields: FieldDef[]; levels: LevelDef[]; settings: TemplateSettings; isActive?: boolean; version?: number;
}

export const PRESETS: Record<string, Partial<TemplateModel>> = {
  MEMO: {
    prefix: "MEMO", icon: "📝", color: "#722ed1",
    fields: [
      { key: "to", label: "To", type: "text", required: true, width: "half" },
      { key: "subject", label: "Subject", type: "text", required: true, width: "half" },
      { key: "body", label: "Memo body", type: "richtext", required: true, width: "full" },
      { key: "effectiveDate", label: "Effective date", type: "date", width: "half" },
      { key: "confidential", label: "Confidential", type: "checkbox", width: "half" },
    ],
    settings: { titleTemplate: "Memo: {{subject}}", allowAttachments: true },
  },
  REQUISITION: {
    prefix: "PR", icon: "🛒", color: "#13c2c2",
    fields: [
      { key: "purpose", label: "Purpose", type: "textarea", required: true, width: "full" },
      { key: "neededBy", label: "Needed by", type: "date", width: "half" },
      { key: "costCentre", label: "Cost centre", type: "select", options: ["Operations", "Sales", "IT", "HR", "Finance"], width: "half" },
      { key: "items", label: "Items", type: "table", required: true, minRows: 1, totalColumn: "total", width: "full", columns: [
        { key: "description", label: "Description", type: "text", required: true },
        { key: "quantity", label: "Qty", type: "number", required: true, width: 90 },
        { key: "unitPrice", label: "Unit price", type: "currency", required: true, width: 130 },
        { key: "total", label: "Total", type: "computed", formula: "quantity * unitPrice", sum: true, width: 130 },
      ] },
      { key: "supplier", label: "Preferred supplier", type: "text", width: "half" },
    ],
    settings: { titleTemplate: "Purchase requisition: {{purpose}}", allowAttachments: true, dueInDays: 7 },
  },
  DOCUMENT: {
    prefix: "DOC", icon: "📄", color: "#fa8c16",
    fields: [
      { key: "documentTitle", label: "Document title", type: "text", required: true, width: "half" },
      { key: "documentType", label: "Document type", type: "select", options: ["Policy", "Contract", "Report", "Procedure", "Other"], required: true, width: "half" },
      { key: "summary", label: "Summary of changes", type: "textarea", required: true, width: "full" },
      { key: "reviewer", label: "Reviewer", type: "user", width: "half" },
      { key: "attachment", label: "Document file", type: "file", width: "half" },
    ],
    settings: { titleTemplate: "{{documentType}}: {{documentTitle}}", allowAttachments: true, requireAttachment: true },
  },
};

export function TemplateBuilder({ initial }: { initial: TemplateModel | null }) {
  const router = useRouter();
  const { message } = App.useApp();
  const { data: me } = useMe();
  const [model, setModel] = useState<TemplateModel>(initial || { name: "", category: "CUSTOM", prefix: "REQ", fields: [], levels: [], settings: { allowAttachments: true }, isActive: true });
  const [saving, setSaving] = useState(false);
  const [previewForm] = Form.useForm();
  const set = (patch: Partial<TemplateModel>) => setModel((m) => ({ ...m, ...patch }));

  const applyPreset = (category: TemplateCategory) => {
    const p = PRESETS[category];
    set({ category, ...(p && model.fields.length === 0 ? p : {}), ...(p && !model.name ? { name: CATEGORY_LABELS[category] } : {}) });
  };

  const save = async () => {
    if (!model.name.trim()) return message.error("Give the workflow a name");
    setSaving(true);
    try {
      const payload = { ...model, id: undefined, version: undefined };
      const saved = model.id
        ? await api<TemplateModel>(`/api/templates/${model.id}`, { method: "PUT", json: payload })
        : await api<TemplateModel>("/api/templates", { method: "POST", json: payload });
      message.success("Workflow saved");
      if (!model.id) router.replace(`/app/templates/${saved.id}`);
      setModel(saved);
    } catch (e) {
      const err = e as { message: string; details?: { message: string }[] };
      message.error(err.details?.length ? err.details.map((d) => d.message).join("; ") : err.message);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-head-left">
          <Link href="/app/templates"><Button icon={<ArrowLeftOutlined />} type="text" /></Link>
          <div>
            <Typography.Title level={3} className="page-title">{model.id ? `Edit workflow` : "New workflow"}</Typography.Title>
            <Typography.Text type="secondary">{model.id ? `Version ${model.version}. Saving creates a new version; in-flight requests keep the version they started with.` : "Pick a category to start from a preset, then customise fields and levels."}</Typography.Text>
          </div>
        </div>
        <Space>
          <span className="muted">Active</span><Switch checked={model.isActive !== false} onChange={(isActive) => set({ isActive })} />
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} md={8}><label className="muted">Name</label><Input value={model.name} onChange={(e) => set({ name: e.target.value })} placeholder="Purchase requisition" /></Col>
          <Col xs={12} md={5}><label className="muted">Category</label><Select style={{ width: "100%" }} value={model.category} onChange={applyPreset} options={(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} /></Col>
          <Col xs={6} md={3}><label className="muted">Prefix</label><Input className="mono" value={model.prefix} maxLength={10} onChange={(e) => set({ prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} /></Col>
          <Col xs={6} md={2}><label className="muted">Icon</label><Input value={model.icon || ""} onChange={(e) => set({ icon: e.target.value })} placeholder="📝" /></Col>
          <Col xs={12} md={3}><label className="muted">Colour</label><Input type="color" value={model.color || "#1677ff"} onChange={(e) => set({ color: e.target.value })} /></Col>
          <Col xs={24} md={24} style={{ marginTop: 10 }}><label className="muted">Description</label><Input value={model.description || ""} onChange={(e) => set({ description: e.target.value })} placeholder="When to use this workflow" /></Col>
        </Row>
      </Card>

      <Tabs
        items={[
          { key: "fields", label: `Form fields (${model.fields.length})`, children: <FieldsEditor fields={model.fields} onChange={(fields) => set({ fields })} /> },
          { key: "canvas", label: <span><BranchesOutlined /> Approval flow canvas ({model.levels.length})</span>, children: <WorkflowCanvas levels={model.levels} fields={model.fields} onChange={(levels) => set({ levels })} /> },
          { key: "levels", label: <span><UnorderedListOutlined /> Levels as a list</span>, children: <LevelsEditor levels={model.levels} fields={model.fields} onChange={(levels) => set({ levels })} /> },
          {
            key: "settings", label: "Rules", children: (
              <Card size="small">
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <label className="muted">Title template (uses field keys)</label>
                    <Input value={model.settings.titleTemplate || ""} onChange={(e) => set({ settings: { ...model.settings, titleTemplate: e.target.value } })} placeholder="Purchase requisition: {{purpose}}" />
                  </Col>
                  <Col xs={12} md={6}>
                    <label className="muted">Default priority</label>
                    <Select style={{ width: "100%" }} value={model.settings.defaultPriority || "NORMAL"} onChange={(defaultPriority) => set({ settings: { ...model.settings, defaultPriority } })} options={["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => ({ value: p, label: p }))} />
                  </Col>
                  <Col xs={12} md={6}>
                    <label className="muted">Due in (days)</label>
                    <InputNumber style={{ width: "100%" }} min={0} value={model.settings.dueInDays ?? undefined} onChange={(v) => set({ settings: { ...model.settings, dueInDays: v ?? undefined } })} />
                  </Col>
                  <Col xs={24} md={12}>
                    <label className="muted">Who can raise this request (blank = everyone)</label>
                    <Select mode="multiple" style={{ width: "100%" }} value={model.settings.requesterRoles || []} onChange={(requesterRoles) => set({ settings: { ...model.settings, requesterRoles } })} options={["OWNER", "ADMIN", "MANAGER", "MEMBER"].map((r) => ({ value: r, label: r }))} />
                  </Col>
                  <Col xs={24} md={12}>
                    <label className="muted">Cost field (feeds project spend totals)</label>
                    <Select style={{ width: "100%" }} value={model.settings.costField || "auto"} onChange={(v) => set({ settings: { ...model.settings, costField: v === "auto" ? undefined : v } })}
                      options={[{ value: "auto", label: "Auto-detect (first table total or currency field)" }, { value: "none", label: "This workflow has no cost" }, ...costFieldOptions(model.fields)]} />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Recorded on each request when it is saved or submitted and summed per project.</Typography.Text>
                  </Col>
                  <Col span={24}>
                    <Space size="large" wrap>
                      <span><Switch size="small" checked={model.settings.allowAttachments !== false} onChange={(v) => set({ settings: { ...model.settings, allowAttachments: v } })} /> Allow attachments</span>
                      <span><Switch size="small" checked={!!model.settings.requireAttachment} onChange={(v) => set({ settings: { ...model.settings, requireAttachment: v } })} /> Require an attachment</span>
                      <span><Switch size="small" checked={model.settings.allowRequesterCancel !== false} onChange={(v) => set({ settings: { ...model.settings, allowRequesterCancel: v } })} /> Requester may cancel after submitting</span>
                      <span><Switch size="small" checked={!!model.settings.notifyRequesterOnEachLevel} onChange={(v) => set({ settings: { ...model.settings, notifyRequesterOnEachLevel: v } })} /> Notify requester at each level</span>
                      <span><Switch size="small" checked={!!model.settings.requireProject} onChange={(v) => set({ settings: { ...model.settings, requireProject: v } })} /> Require a project on every request</span>
                      <span><Switch size="small" checked={!!model.settings.createsTrip} onChange={(v) => set({ settings: { ...model.settings, createsTrip: v } })} /> Book a vehicle trip when approved (fields: destination, dates, passengers, purpose)</span>
                    </Space>
                    <div style={{ marginTop: 10 }}>
                      <Typography.Text style={{ marginRight: 8 }}>Advances ledger:</Typography.Text>
                      <Select size="small" style={{ width: 360 }} value={model.settings.advances || "none"} onChange={(v) => set({ settings: { ...model.settings, advances: v === "none" ? undefined : (v as "open" | "clear") } })} options={[{ value: "none", label: "Not linked" }, { value: "open", label: "Approval opens an advance for the cost amount (T&S advance)" }, { value: "clear", label: "Approval clears advances listed in the claim (T&S claim)" }]} />
                    </div>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: "preview", label: <span><EyeOutlined /> Preview</span>, children: (
              <Card title="How requesters will see the form">
                <Form form={previewForm} layout="vertical" initialValues={defaultsFor(model.fields)}>
                  <DynamicFields fields={model.fields} currency={me?.org.settings.currency || "USD"} />
                </Form>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
