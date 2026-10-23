"use client";

import { Alert, App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useApi, useMe } from "@/lib/client";
import { CASE_PRIORITIES, CASE_PRIORITY_LABELS, CASE_SOURCES, CASE_SOURCE_LABELS } from "@/lib/caseTypes";

interface Dup { id: string; referenceNo: string; title: string; status: string; reason: string }

export default function NewCasePage() {
  const { message } = App.useApp();
  const router = useRouter();
  const { data: me } = useMe();
  const [form] = Form.useForm();
  const { data: departments } = useApi<{ id: string; name: string }[]>("/api/departments");
  const { data: categories } = useApi<{ id: string; name: string; departmentId: string; defaultSlaHours: number; defaultPriority: string }[]>("/api/case-categories");
  const { data: projects } = useApi<{ id: string; code: string; name: string }[]>("/api/projects");
  const [dups, setDups] = useState<Dup[]>([]);
  const [saving, setSaving] = useState(false);
  const categoryId = Form.useWatch("categoryId", form);
  const departmentId = Form.useWatch("departmentId", form);
  const title = Form.useWatch("title", form);
  const locationAddress = Form.useWatch("locationAddress", form);
  const source = Form.useWatch("source", form);

  useEffect(() => {
    const cat = categories?.find((c) => c.id === categoryId);
    if (cat) form.setFieldsValue({ departmentId: cat.departmentId, priority: cat.defaultPriority });
  }, [categoryId, categories, form]);
  useEffect(() => {
    if (!title && !locationAddress) return;
    const t = setTimeout(async () => {
      try { setDups(await api<Dup[]>("/api/cases/check-duplicates", { method: "POST", json: { categoryId: categoryId || null, departmentId: departmentId || null, title: title || null, locationAddress: locationAddress || null } })); } catch { /* advisory */ }
    }, 500);
    return () => clearTimeout(t);
  }, [title, locationAddress, categoryId, departmentId]);
  useEffect(() => { if (me && source === "STAFF") form.setFieldsValue({ reporterName: me.user.name, reporterEmail: me.user.email }); }, [me, source, form]);

  const submit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const c = await api<{ id: string; referenceNo: string }>("/api/cases", { method: "POST", json: values });
      message.success(`Logged as ${c.referenceNo}`);
      router.replace(`/app/cases?open=${c.id}`);
    } catch (e) { message.error((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-head-left">
          <Link href="/app/cases"><Button type="text" icon={<ArrowLeftOutlined />} /></Link>
          <div><div className="title-row"><Typography.Title level={3} className="page-title">Log a case</Typography.Title></div><div className="muted">Phone calls, walk-ins, emails or something you noticed yourself.</div></div>
        </div>
      </div>
      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card>
            <Form form={form} layout="vertical" onFinish={submit} initialValues={{ source: "STAFF", priority: "MEDIUM" }}>
              <Row gutter={12}>
                <Col xs={24} md={8}><Form.Item name="source" label="How it reached us" rules={[{ required: true }]}><Select options={CASE_SOURCES.filter((s) => s !== "PUBLIC").map((s) => ({ value: s, label: CASE_SOURCE_LABELS[s] }))} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="categoryId" label="Category" extra="Sets the section, SLA and default priority"><Select allowClear showSearch optionFilterProp="label" placeholder="Choose" options={(categories || []).map((c) => ({ value: c.id, label: `${c.name} · ${c.defaultSlaHours}h` }))} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="departmentId" label="Section" rules={[{ required: true, message: "Which section handles this?" }]}><Select showSearch optionFilterProp="label" options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Form.Item></Col>
              </Row>
              <Form.Item name="title" label="Title" rules={[{ required: true, min: 3 }]}><Input placeholder="e.g. Printer on 7th floor not working" maxLength={255} /></Form.Item>
              <Form.Item name="description" label="Description" rules={[{ required: true, min: 5 }]}><Input.TextArea autoSize={{ minRows: 4 }} placeholder="What happened, where, since when, and what has been tried." /></Form.Item>
              <Row gutter={12}>
                <Col xs={24} md={8}><Form.Item name="priority" label="Priority"><Select options={CASE_PRIORITIES.map((p) => ({ value: p, label: CASE_PRIORITY_LABELS[p] }))} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="projectId" label="Project / survey"><Select allowClear showSearch optionFilterProp="label" options={(projects || []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="office" label="Office / station"><Input placeholder="Head Office, 7th floor" /></Form.Item></Col>
              </Row>
              <Form.Item name="locationAddress" label="Location"><Input placeholder="Room, building, site or address" /></Form.Item>
              <Typography.Text strong>Reporter</Typography.Text>
              <Row gutter={12} style={{ marginTop: 8 }}>
                <Col xs={24} md={8}><Form.Item name="reporterName" label="Name" rules={[{ required: true, min: 2 }]}><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="reporterPhone" label="Phone"><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="reporterEmail" label="Email" rules={[{ type: "email" }]}><Input /></Form.Item></Col>
              </Row>
              <Space><Button type="primary" htmlType="submit" loading={saving}>Log case</Button><Link href="/app/cases"><Button>Cancel</Button></Link></Space>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          {dups.length > 0 && (
            <Alert type="warning" showIcon title="Possible duplicates" description={<ul style={{ paddingLeft: 18, margin: 0 }}>{dups.map((d) => <li key={d.id}><Link href={`/app/cases?open=${d.id}`}><span className="mono">{d.referenceNo}</span></Link> {d.title} <span className="muted">· {d.reason}</span></li>)}</ul>} style={{ marginBottom: 12 }} />
          )}
          <Card size="small" title="How routing works">
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>Choosing a category sets the section and its service target. The case is assigned automatically to the least busy officer in that section (officers on leave are skipped in favour of their delegate). If the section has nobody available it goes to the section head.</Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>Reporters with an email address receive the reference number and every public update.</Typography.Paragraph>
          </Card>
        </Col>
      </Row>
      <InputNumber style={{ display: "none" }} />
    </div>
  );
}
