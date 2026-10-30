"use client";

import { App, Button, Card, Col, Empty, Form, Input, Row, Select, Skeleton, Space, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LeaveBalance } from "@/components/LeaveBalance";
import { AdvanceBalance } from "@/components/AdvanceBalance";
import { api, useApi, useMe } from "@/lib/client";
import { DynamicFields, defaultsFor } from "@/components/DynamicForm";
import { ProjectPicker } from "@/components/ProjectPicker";
import type { FieldDef, TemplateSettings } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

interface Template { id: string; name: string; description?: string | null; category: keyof typeof CATEGORY_LABELS; icon?: string | null; color?: string | null; fields: FieldDef[]; levels: unknown[]; settings: TemplateSettings }

function NewRequest() {
  const router = useRouter();
  const params = useSearchParams();
  const { message } = App.useApp();
  const { data: me } = useMe();
  const { data: templates, isLoading } = useApi<Template[]>("/api/templates?active=1");
  const [templateId, setTemplateId] = useState<string | null>(params.get("template"));
  const [form] = Form.useForm();
  const daysWatch = Form.useWatch("daysRequired", form);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const template = templates?.find((t) => t.id === templateId) || null;
  const currency = me?.org.settings.currency || "USD";

  const templateKey = template?.id;
  useEffect(() => {
    // Reset the form only when the chosen workflow changes, not on every SWR revalidation.
    if (template) form.setFieldsValue({ title: "", priority: template.settings.defaultPriority || "NORMAL", projectId: params.get("project") || undefined, ...defaultsFor(template.fields) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey, form]);

  const save = async (submit: boolean) => {
    if (!template) return;
    try {
      const values = submit ? await form.validateFields() : form.getFieldsValue(true);
      const { title, priority, projectId, ...data } = values;
      setSaving(submit ? "submit" : "draft");
      const r = await api<{ id: string }>("/api/requests", { method: "POST", json: { templateId: template.id, title, priority, projectId: projectId || null, data, submit } });
      message.success(submit ? "Request submitted" : "Draft saved");
      router.push(`/app/requests/${r.id}`);
    } catch (e) {
      const err = e as { message?: string; details?: { path: string; message: string }[]; errorFields?: unknown };
      if (err.errorFields) return; // antd validation
      message.error(err.details?.length ? err.details.map((d) => d.message).join("; ") : err.message || "Failed");
    } finally {
      setSaving(null);
    }
  };

  const visible = templates?.filter((t) => !t.settings.requesterRoles?.length || (me && t.settings.requesterRoles.includes(me.user.role))) || [];

  return (
    <div>
      <div className="page-header">
        <Space>
          <Link href="/app/requests"><Button icon={<ArrowLeftOutlined />} type="text" /></Link>
          <Typography.Title level={3} className="page-title">New request</Typography.Title>
        </Space>
      </div>
      {isLoading ? <Skeleton active /> : !template ? (
        visible.length === 0 ? <Empty description="No active workflows yet. Ask an admin to create one." /> : (
          <Row gutter={[16, 16]}>
            {visible.map((t) => (
              <Col xs={24} sm={12} lg={8} key={t.id}>
                <Card hoverable onClick={() => setTemplateId(t.id)} style={{ height: "100%", borderTop: `3px solid ${t.color || "#1677ff"}` }}>
                  <Typography.Text strong style={{ fontSize: 16 }}>{t.icon ? `${t.icon} ` : ""}{t.name}</Typography.Text>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{CATEGORY_LABELS[t.category] || t.category} · {t.levels.length} level{t.levels.length === 1 ? "" : "s"}</div>
                  <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>{t.description || "No description"}</Typography.Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
        )
      ) : (
        <Row gutter={16}>
          <Col xs={24} lg={17}>
            <Card title={<span>{template.icon ? `${template.icon} ` : ""}{template.name}</span>} extra={<Button type="link" onClick={() => setTemplateId(null)}>Change workflow</Button>}>
              <Form form={form} layout="vertical" requiredMark="optional">
                <Row gutter={16}>
                  <Col xs={24} md={12}><Form.Item name="title" label="Title" rules={template.settings.titleTemplate ? [] : [{ required: true, message: "Give the request a title" }]}><Input placeholder={template.settings.titleTemplate ? `Leave blank to use: ${template.settings.titleTemplate}` : "Short summary"} /></Form.Item></Col>
                  <Col xs={24} md={7}><Form.Item name="projectId" label="Project" rules={template.settings.requireProject ? [{ required: true, message: "Choose a project" }] : []} extra="Costs on this request count towards the project."><ProjectPicker placeholder={template.settings.requireProject ? "Choose a project" : "No project"} /></Form.Item></Col>
                  <Col xs={24} md={5}><Form.Item name="priority" label="Priority"><Select options={["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => ({ value: p, label: p }))} /></Form.Item></Col>
                </Row>
                {template.category === "LEAVE" && <LeaveBalance requestedDays={Number(daysWatch) || undefined} compact />}
                {template.settings.advances && <AdvanceBalance compact />}
                <DynamicFields fields={template.fields} currency={currency} />
              </Form>
            </Card>
          </Col>
          <Col xs={24} lg={7}>
            <Card title="Submit">
              <Typography.Paragraph type="secondary">
                Save as draft to keep editing and attach files, or submit now to start the approval chain.
              </Typography.Paragraph>
              <Space orientation="vertical" style={{ width: "100%" }}>
                <Button block onClick={() => save(false)} loading={saving === "draft"}>Save draft</Button>
                <Button block type="primary" onClick={() => save(true)} loading={saving === "submit"} disabled={!!template.settings.requireAttachment}>Submit for approval</Button>
                {template.settings.requireAttachment && <Typography.Text type="warning" style={{ fontSize: 12 }}>This workflow requires an attachment. Save as draft first, then attach and submit.</Typography.Text>}
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

export default function NewRequestPage() {
  return <Suspense><NewRequest /></Suspense>;
}
