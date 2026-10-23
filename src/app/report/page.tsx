"use client";

import { Alert, App, Button, Card, Col, Form, Input, Result, Row, Select, Space, Typography, Upload } from "antd";
import { EnvironmentOutlined, UploadOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useCallback, useState } from "react";
import { PublicShell, type PortalConfig } from "@/components/PublicShell";
import { api } from "@/lib/client";

interface Created { id: string; referenceNo: string; slaHours: number; trackUrl: string; uploadToken: string; duplicates: { referenceNo: string; title: string; reason: string }[] }

export default function ReportPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [done, setDone] = useState<Created | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<PortalConfig | null>(null);
  const onConfig = useCallback((c: PortalConfig) => setCfg(c), []);

  const locate = () => {
    if (!navigator.geolocation) return message.warning("Location is not available on this device");
    navigator.geolocation.getCurrentPosition((p) => { form.setFieldsValue({ latitude: p.coords.latitude, longitude: p.coords.longitude }); message.success("Location captured"); }, () => message.warning("Could not read your location"));
  };
  const submit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const c = await api<Created>("/api/public/cases", { method: "POST", json: values });
      if (files.length) {
        const fd = new FormData(); files.slice(0, 3).forEach((f) => fd.append("file", f));
        await api(`/api/public/cases/${encodeURIComponent(c.referenceNo)}/attachments`, { method: "POST", body: fd, headers: { "x-upload-token": c.uploadToken } }).catch(() => message.warning("Report saved, but the photos could not be uploaded."));
      }
      setDone(c);
    } catch (e) { message.error((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <PublicShell active="report" onConfig={onConfig}>
      {(c) => done ? (
        <Card>
          <Result status="success" title={`Your reference is ${done.referenceNo}`}
            subTitle={`Keep this number. Our target is to attend to it within ${done.slaHours} hours. We will contact you on the details you gave.`}
            extra={<Space><Link href={done.trackUrl}><Button type="primary">Track this report</Button></Link><Button onClick={() => { setDone(null); setFiles([]); form.resetFields(); }}>Report another</Button></Space>} />
          {done.duplicates.length > 0 && <Alert type="info" showIcon title="Similar reports already exist" description={<ul style={{ margin: 0, paddingLeft: 18 }}>{done.duplicates.map((d) => <li key={d.referenceNo}><span className="mono">{d.referenceNo}</span> {d.title} <span className="muted">· {d.reason}</span></li>)}</ul>} />}
        </Card>
      ) : c && !c.enabled ? (
        <Card><Result status="info" title="Public reporting is not open at the moment" subTitle={c.contactEmail ? `Please contact ${c.contactEmail}.` : undefined} /></Card>
      ) : (
        <Row gutter={16}>
          <Col xs={24} md={15}>
            <Typography.Title level={2} style={{ marginTop: 0 }}>{c?.heading || "Report an issue"}</Typography.Title>
            <Typography.Paragraph type="secondary">{c?.subtext}</Typography.Paragraph>
            <Card>
              <Form form={form} layout="vertical" onFinish={submit}>
                <Form.Item name="website" style={{ display: "none" }}><Input autoComplete="off" tabIndex={-1} /></Form.Item>
                <Form.Item name="categoryId" label="What is it about?" rules={[{ required: true, message: "Choose a category" }]}>
                  <Select size="large" placeholder="Choose a category" options={(c?.categories || []).map((k) => ({ value: k.id, label: `${k.icon ? `${k.icon} ` : ""}${k.name} · ${k.department.name}` }))} />
                </Form.Item>
                <Form.Item name="title" label="Summary" rules={[{ required: true, min: 3 }]}><Input size="large" placeholder="One line, e.g. Request for 2022 census district tables" maxLength={255} /></Form.Item>
                <Form.Item name="description" label="Details" rules={[{ required: true, min: 5 }]}><Input.TextArea autoSize={{ minRows: 4 }} placeholder="Tell us what you need or what happened, with dates and references where you have them." /></Form.Item>
                <Form.Item name="locationAddress" label="Location (if relevant)"><Input placeholder="Office, town or address" suffix={<Button size="small" type="text" icon={<EnvironmentOutlined />} onClick={locate}>Use my location</Button>} /></Form.Item>
                <Form.Item name="latitude" hidden><Input /></Form.Item>
                <Form.Item name="longitude" hidden><Input /></Form.Item>
                <Typography.Text strong>Your details</Typography.Text>
                <Row gutter={12} style={{ marginTop: 8 }}>
                  <Col xs={24} md={8}><Form.Item name="reporterName" label="Full name" rules={[{ required: true, min: 2 }]}><Input autoComplete="name" /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="reporterPhone" label="Phone" extra="Phone or email is required"><Input autoComplete="tel" /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="reporterEmail" label="Email" rules={[{ type: "email" }]}><Input autoComplete="email" /></Form.Item></Col>
                </Row>
                <Form.Item label="Photos or documents (optional, up to 3)">
                  <Upload multiple accept=".jpg,.jpeg,.png,.webp,.pdf" beforeUpload={(f) => { setFiles((x) => [...x, f].slice(0, 3)); return false; }} onRemove={(f) => setFiles((x) => x.filter((y) => y.name !== f.name))} fileList={files.map((f) => ({ uid: f.name, name: f.name }))}>
                    <Button icon={<UploadOutlined />}>Add file</Button>
                  </Upload>
                </Form.Item>
                <Button type="primary" size="large" htmlType="submit" loading={saving} block>Submit report</Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} md={9}>
            <Card size="small" title="What happens next">
              <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
                <li>You get a reference number straight away.</li>
                <li>The responsible section is notified and an officer is assigned.</li>
                <li>You can follow progress under <Link href="/track">Track a report</Link> and you receive updates by email if you gave one.</li>
                <li>When it is resolved you can rate the service.</li>
              </ol>
            </Card>
            {c?.categories?.length ? (
              <Card size="small" title="Service targets" style={{ marginTop: 12 }}>
                {c.categories.map((k) => <div key={k.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span>{k.name}</span><span className="muted">{k.defaultSlaHours} h</span></div>)}
              </Card>
            ) : null}
            {(c?.contactEmail || c?.contactPhone || cfg?.contactPhone) && <Card size="small" title="Contact" style={{ marginTop: 12 }}>{c?.contactEmail && <div>{c.contactEmail}</div>}{c?.contactPhone && <div>{c.contactPhone}</div>}</Card>}
          </Col>
        </Row>
      )}
    </PublicShell>
  );
}
