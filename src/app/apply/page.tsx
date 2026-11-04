"use client";

import { Alert, Button, Card, Checkbox, Col, Descriptions, Form, Input, Result, Row, Select, Space, Steps, Tag, Typography, Upload, message } from "antd";
import { ArrowLeftOutlined, FileProtectOutlined, UploadOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { DynamicFields, defaultsFor } from "@/components/DynamicForm";
import { api, formatMoney } from "@/lib/client";
import { APPLICATION_KIND_LABELS, type ApplicationKind } from "@/lib/licenceTypes";
import type { FieldDef } from "@/lib/types";

interface LType { id: string; code: string; name: string; category: string; description?: string | null; fee: number; currency: string; validityMonths: number; requiresInspection: boolean; requirements: string[]; formTitle?: string | null; legalBasis?: string | null; instructions?: string | null; fields: FieldDef[]; kinds: string[]; department?: { name: string } | null }
interface Catalogue { orgName: string; enabled: boolean; intro: string; paymentInstructions: string; types: LType[] }
interface Created { id: string; referenceNo: string; fee: number; currency: string; requirements: string[]; requiresInspection: boolean; trackUrl: string; uploadToken: string }

const WARDS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const STANDARD_KEYS = new Set(["applicationKind", "applicantName", "tradingName", "idNumber", "phone", "email", "standNumber", "address", "ward", "activity", "declaration", "website"]);

/** Citizen self-service: choose a licence, fill in its form, upload documents, get a reference. No account needed. */
export default function ApplyPage() {
  const [cat, setCat] = useState<Catalogue | null | undefined>(undefined);
  const [type, setType] = useState<LType | null>(null);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [created, setCreated] = useState<Created | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [form] = Form.useForm();
  useEffect(() => { api<Catalogue | null>("/api/public/licensing").then(setCat).catch(() => setCat(null)); }, []);

  const choose = (t: LType) => { setType(t); setFiles({}); form.resetFields(); form.setFieldsValue({ ...defaultsFor(t.fields || []), applicationKind: t.kinds?.[0] || "NEW" }); window.scrollTo({ top: 0 }); };

  const submit = async (values: Record<string, unknown>) => {
    if (!type) return;
    setSaving(true);
    try {
      const standard: Record<string, unknown> = {}; const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) { if (STANDARD_KEYS.has(k)) standard[k] = v; else data[k] = v; }
      const c = await api<Created>("/api/public/licences", { method: "POST", json: { ...standard, data, typeId: type.id } });
      setCreated(c);
      const done: string[] = [];
      for (const [label, list] of Object.entries(files)) {
        if (!list.length) continue;
        const fd = new FormData();
        fd.append("label", label);
        list.forEach((f) => fd.append("file", f));
        await api(`/api/public/licences/${encodeURIComponent(c.referenceNo)}/attachments`, { method: "POST", body: fd, headers: { "x-upload-token": c.uploadToken } }).then(() => done.push(label)).catch(() => message.warning(`Application saved, but ${label} could not be uploaded. You can add it later from the tracking page.`));
      }
      setUploaded(done);
      window.scrollTo({ top: 0 });
    } catch (e) { message.error((e as Error).message); } finally { setSaving(false); }
  };

  const grouped = Object.entries((cat?.types || []).reduce<Record<string, LType[]>>((acc, t) => { (acc[t.category] ||= []).push(t); return acc; }, {}));

  return (
    <PublicShell active="apply">
      {() => (
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          {created ? (
            <Card>
              <Result status="success" title={<span>Application received: <span className="mono">{created.referenceNo}</span></span>}
                subTitle={<span>Keep this reference. Track progress at any time with your reference and the phone number you gave. {created.requiresInspection ? "An officer will contact you to inspect the premises. " : ""}Once approved, pay the fee of <b>{formatMoney(created.fee, created.currency)}</b> and submit the payment reference on the tracking page; the licence is issued once Finance confirms the payment.</span>}
                extra={[<Link key="t" href={created.trackUrl}><Button type="primary">Track this application</Button></Link>, <Button key="a" onClick={() => { setCreated(null); setType(null); setFiles({}); setUploaded([]); }}>Apply for another licence</Button>]} />
              {created.requirements.length > 0 && (
                <div style={{ maxWidth: 560, margin: "0 auto" }}>
                  <Typography.Title level={5}>Supporting documents</Typography.Title>
                  {created.requirements.map((r) => <div key={r} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>{uploaded.includes(r) ? <Tag color="green">Uploaded</Tag> : <Tag>Outstanding</Tag>} {r}</div>)}
                  <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>Outstanding documents can be uploaded later from the tracking page, or brought to the licensing office at the Civic Centre.</Typography.Paragraph>
                </div>
              )}
            </Card>
          ) : (
            <>
              <Typography.Title level={3} className="page-title" style={{ marginBottom: 4 }}>Apply for a licence or permit</Typography.Title>
              <Typography.Paragraph type="secondary">{cat?.intro || "Apply for council licences and permits online."}</Typography.Paragraph>
              {cat === null && <Alert type="warning" showIcon title="Online applications are not available right now. Please visit the licensing office." />}
              <Steps size="small" current={type ? 1 : 0} items={[{ title: "Choose a licence" }, { title: "Fill in the form" }, { title: "Documents & submit" }]} style={{ marginBottom: 24 }} />
              {!type ? (
                grouped.map(([category, list]) => (
                  <div key={category} style={{ marginBottom: 20 }}>
                    <Typography.Title level={5} style={{ marginBottom: 8 }}>{category}</Typography.Title>
                    <Row gutter={[12, 12]}>
                      {list.map((t) => (
                        <Col xs={24} md={12} key={t.id}>
                          <Card hoverable onClick={() => choose(t)} styles={{ body: { padding: 16 } }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <div><div style={{ fontWeight: 600 }}><FileProtectOutlined style={{ marginRight: 8, color: "var(--brand-color)" }} />{t.name}</div>{t.legalBasis && <div className="muted" style={{ fontSize: 12 }}>{t.legalBasis}</div>}<div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.description}</div></div>
                              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}><div style={{ fontWeight: 600 }}>{formatMoney(t.fee, t.currency)}</div><div className="muted" style={{ fontSize: 12 }}>{t.validityMonths} months</div></div>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12 }} className="muted">{t.requirements.length} document{t.requirements.length === 1 ? "" : "s"} required{t.requiresInspection ? " · premises inspected" : ""}</div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))
              ) : (
                <Row gutter={24}>
                  <Col xs={24} lg={16}>
                    <Card>
                      <a onClick={() => setType(null)} className="muted" style={{ fontSize: 13 }}><ArrowLeftOutlined /> Choose a different licence</a>
                      <Typography.Title level={4} style={{ marginTop: 8, marginBottom: 0 }}>{type.formTitle || type.name}</Typography.Title>
                      <Typography.Text type="secondary">{type.name}{type.legalBasis ? ` · ${type.legalBasis}` : ""}</Typography.Text>
                      <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }}>
                        {(type.kinds?.length || 0) > 1 && <Form.Item name="applicationKind" label="Type of application" rules={[{ required: true }]}><Select options={type.kinds.map((k) => ({ value: k, label: APPLICATION_KIND_LABELS[k as ApplicationKind] || k }))} /></Form.Item>}
                        <Typography.Title level={5}>Particulars of applicant</Typography.Title>
                        <Row gutter={16}>
                          <Col xs={24} md={12}><Form.Item name="applicantName" label="Full name of applicant" rules={[{ required: true, min: 2 }]} extra="As on your national ID or company registration"><Input /></Form.Item></Col>
                          <Col xs={24} md={12}><Form.Item name="tradingName" label="Name under which the trade or business is or will be conducted"><Input /></Form.Item></Col>
                          <Col xs={24} md={8}><Form.Item name="idNumber" label="National ID / company number"><Input /></Form.Item></Col>
                          <Col xs={24} md={8}><Form.Item name="phone" label="Mobile phone" rules={[{ required: true, min: 6 }]} extra="Used to track the application and for updates"><Input placeholder="07xx xxx xxx" /></Form.Item></Col>
                          <Col xs={24} md={8}><Form.Item name="email" label="Email (optional)" rules={[{ type: "email" }]}><Input /></Form.Item></Col>
                        </Row>
                        <Typography.Title level={5}>Situation of the premises</Typography.Title>
                        <Row gutter={16}>
                          <Col xs={24} md={8}><Form.Item name="standNumber" label="Stand number"><Input placeholder="e.g. 1120 Zimre Park" /></Form.Item></Col>
                          <Col xs={24} md={10}><Form.Item name="address" label="Street / physical address"><Input /></Form.Item></Col>
                          <Col xs={24} md={6}><Form.Item name="ward" label="Ward"><Select allowClear options={WARDS.map((w) => ({ value: w, label: `Ward ${w}` }))} /></Form.Item></Col>
                          <Col xs={24}><Form.Item name="activity" label="Describe the trade, business or purpose" rules={[{ required: true, min: 5, message: "Describe the business or purpose" }]}><Input.TextArea rows={3} placeholder="What you sell or do, trading hours, number of employees" /></Form.Item></Col>
                        </Row>
                        {type.fields.length > 0 && <DynamicFields fields={type.fields} currency={type.currency} />}
                        <Form.Item name="website" style={{ display: "none" }}><Input autoComplete="off" tabIndex={-1} /></Form.Item>
                        {type.requirements.length > 0 && (
                          <>
                            <Typography.Title level={5}>Supporting documents</Typography.Title>
                            <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>Photos or PDF scans, up to 8 MB each. You can also upload later from the tracking page or bring originals to the office.</Typography.Paragraph>
                            {type.requirements.map((r) => (
                              <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                                <span>{r}</span>
                                <Upload accept=".jpg,.jpeg,.png,.webp,.pdf" multiple beforeUpload={(f) => { setFiles((x) => ({ ...x, [r]: [...(x[r] || []), f].slice(0, 3) })); return false; }} onRemove={(f) => setFiles((x) => ({ ...x, [r]: (x[r] || []).filter((y) => y.name !== f.name) }))} fileList={(files[r] || []).map((f) => ({ uid: f.name, name: f.name }))}>
                                  <Button size="small" icon={<UploadOutlined />}>Attach</Button>
                                </Upload>
                              </div>
                            ))}
                          </>
                        )}
                        {type.instructions && <Typography.Paragraph type="secondary" style={{ fontSize: 12, whiteSpace: "pre-line", marginTop: 16 }}>{type.instructions}</Typography.Paragraph>}
                        <Form.Item name="declaration" valuePropName="checked" rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error("You must accept the declaration"))) }]} style={{ marginTop: 16 }}>
                          <Checkbox>I declare that the information given in this application is true and correct, and that I will comply with the council by-laws and the conditions of the licence. I understand that a false statement is an offence and may lead to cancellation of the licence.</Checkbox>
                        </Form.Item>
                        <Space><Button type="primary" htmlType="submit" loading={saving} size="large">Submit application</Button><Button onClick={() => setType(null)}>Back</Button></Space>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={8}>
                    <Card title="What to expect">
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="Fee">{formatMoney(type.fee, type.currency)} (payable once approved)</Descriptions.Item>
                        <Descriptions.Item label="Validity">{type.validityMonths} months</Descriptions.Item>
                        <Descriptions.Item label="Inspection">{type.requiresInspection ? "An officer inspects the premises before approval" : "Not required"}</Descriptions.Item>
                        {type.department && <Descriptions.Item label="Handled by">{type.department.name}</Descriptions.Item>}
                      </Descriptions>
                      <ol style={{ paddingLeft: 18, margin: "12px 0 0", fontSize: 13 }}>
                        <li>Submit this form; you receive a reference number.</li>
                        <li>The licensing office checks your documents.</li>
                        {type.requiresInspection && <li>An inspector visits the premises.</li>}
                        <li>Approval by the head of department.</li>
                        <li>Pay the fee and send the payment reference; Finance confirms it.</li>
                        <li>Licence issued; collect the certificate.</li>
                      </ol>
                      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}><b>Paying the fee:</b> {cat?.paymentInstructions}</Typography.Paragraph>
                      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>You can also apply on WhatsApp: send <b>licence</b> to the council WhatsApp number.</Typography.Paragraph>
                    </Card>
                  </Col>
                </Row>
              )}
            </>
          )}
        </div>
      )}
    </PublicShell>
  );
}
