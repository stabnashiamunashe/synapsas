"use client";

import { Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Result, Row, Segmented, Select, Space, Steps, Tag, Timeline, Typography, Upload, message } from "antd";
import { SafetyCertificateOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { DataView } from "@/components/DataView";
import { api, formatDate, formatMoney } from "@/lib/client";
import { StatusTag } from "@/components/StatusTag";
import { APPLICATION_KIND_LABELS, LICENCE_EVENT_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type ApplicationKind, type PaymentMethod } from "@/lib/licenceTypes";
import type { FieldDef } from "@/lib/types";

interface Verified { licenceNo: string; type: string; category: string; holder: string; premises: string | null; status: string; issuedAt: string | null; expiresAt: string | null }
interface Tracked {
  referenceNo: string; licenceNo: string | null; status: string; statusLabel: string; nextStep: string; applicationKind: string; type: string; category: string; formTitle: string | null; legalBasis: string | null; applicant: string; tradingName: string | null; premises: string | null;
  fee: number; currency: string; paidAt: string | null; receiptNo: string | null; issuedAt: string | null; expiresAt: string | null; inspectionDue: string | null; inspectedAt: string | null; inspectionOutcome: string | null; conditions: string | null; decisionNote: string | null; submittedAt: string;
  fields: FieldDef[]; data: Record<string, unknown>;
  documents: { name: string; received: boolean }[]; attachments: { id: string; label: string | null; fileName: string; size: number; createdAt: string }[]; timeline: { kind: string; toStatus: string | null; note: string | null; createdAt: string }[]; uploadToken: string;
  payments: { id: string; amount: number; currency: string; method: string; reference: string | null; paidAt: string; status: string; note: string | null }[]; payment: { confirmed: number; pending: number; fee: number; settled: boolean; outstanding: number }; canPay: boolean;
}

const STAGES = ["SUBMITTED", "UNDER_REVIEW", "INSPECTION", "APPROVED", "ISSUED"];

function VerifyInner() {
  const params = useSearchParams();
  const [mode, setMode] = useState<string>(params.get("ref") ? "track" : "verify");
  const [data, setData] = useState<Verified | null | undefined>(undefined);
  const [tracked, setTracked] = useState<Tracked | null | undefined>(undefined);
  const [contact, setContact] = useState<{ ref: string; phone: string }>({ ref: params.get("ref") || "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payForm] = Form.useForm();

  const lookup = async (v: { no: string }) => {
    setLoading(true);
    try { setData(await api<Verified | null>(`/api/public/licence-verify?no=${encodeURIComponent(v.no.trim())}`)); } catch { setData(null); } finally { setLoading(false); }
  };
  const track = async (v: { ref: string; phone: string }) => {
    setLoading(true); setContact(v);
    try { setTracked(await api<Tracked>(`/api/public/licences/${encodeURIComponent(v.ref.trim())}?phone=${encodeURIComponent(v.phone.trim())}`)); } catch { setTracked(null); } finally { setLoading(false); }
  };
  const upload = async (label: string, file: File) => {
    if (!tracked) return;
    setUploading(label);
    try {
      const fd = new FormData(); fd.append("label", label); fd.append("file", file);
      await api(`/api/public/licences/${encodeURIComponent(tracked.referenceNo)}/attachments`, { method: "POST", body: fd, headers: { "x-upload-token": tracked.uploadToken } });
      message.success(`${label} uploaded`);
      await track(contact);
    } catch (e) { message.error((e as Error).message); } finally { setUploading(null); }
  };
  const submitPayment = async (v: { method: PaymentMethod; reference: string; amount: number; paidAt?: dayjs.Dayjs; payerName?: string; proof?: { file: File }[] }) => {
    if (!tracked) return;
    setPaying(true);
    try {
      await api(`/api/public/licences/${encodeURIComponent(tracked.referenceNo)}/payments`, { method: "POST", json: { method: v.method, reference: v.reference, amount: v.amount, paidAt: v.paidAt ? v.paidAt.format("YYYY-MM-DD") : undefined, payerName: v.payerName }, headers: { "x-upload-token": tracked.uploadToken } });
      const proof = v.proof?.[0]?.file;
      if (proof) { const fd = new FormData(); fd.append("label", "Proof of payment"); fd.append("file", proof); await api(`/api/public/licences/${encodeURIComponent(tracked.referenceNo)}/attachments`, { method: "POST", body: fd, headers: { "x-upload-token": tracked.uploadToken } }).catch(() => message.warning("Payment recorded, but the proof could not be uploaded.")); }
      message.success("Payment details sent to Finance for confirmation");
      payForm.resetFields();
      await track(contact);
    } catch (e) { message.error((e as Error).message); } finally { setPaying(false); }
  };
  const stageIndex = tracked ? Math.max(0, STAGES.indexOf(tracked.status === "UNDER_REVIEW" && tracked.inspectedAt ? "INSPECTION" : tracked.status)) : 0;
  const closed = tracked && ["REJECTED", "CANCELLED", "REVOKED", "EXPIRED", "SUSPENDED"].includes(tracked.status);
  const canUpload = tracked && !["ISSUED", "REJECTED", "REVOKED", "CANCELLED", "EXPIRED"].includes(tracked.status);

  return (
    <PublicShell active="verify">
      {() => (
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Segmented block value={mode} onChange={(v) => setMode(String(v))} options={[{ label: "Track my application", value: "track" }, { label: "Verify a licence", value: "verify" }]} style={{ marginBottom: 20 }} />
          {mode === "verify" ? (
            <>
              <Typography.Title level={3} className="page-title" style={{ marginBottom: 4 }}>Verify a licence</Typography.Title>
              <Typography.Paragraph type="secondary">Enter the licence number shown on the certificate (for example RLB/SHP/{new Date().getFullYear()}/0001) to confirm it was issued by the council and is still valid.</Typography.Paragraph>
              <Card>
                <Form layout="inline" onFinish={lookup} style={{ gap: 8 }}>
                  <Form.Item name="no" rules={[{ required: true, message: "Enter the licence number" }]} style={{ flex: 1, minWidth: 240 }}><Input size="large" placeholder="RLB/SHP/2026/0001" prefix={<SafetyCertificateOutlined />} /></Form.Item>
                  <Button size="large" type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>Check</Button>
                </Form>
              </Card>
              {data === null && <Result status="warning" title="No licence with that number" subTitle="Check the number and try again. If a certificate shows this number, report it to the licensing office." style={{ marginTop: 16 }} />}
              {data && (
                <Card style={{ marginTop: 16 }} title={<span>Licence <span className="mono">{data.licenceNo}</span></span>} extra={<StatusTag status={data.status} />}>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Licence">{data.type} · {data.category}</Descriptions.Item>
                    <Descriptions.Item label="Holder">{data.holder}</Descriptions.Item>
                    {data.premises && <Descriptions.Item label="Premises">{data.premises}</Descriptions.Item>}
                    <Descriptions.Item label="Valid from">{formatDate(data.issuedAt)}</Descriptions.Item>
                    <Descriptions.Item label="Valid until">{formatDate(data.expiresAt)}</Descriptions.Item>
                  </Descriptions>
                </Card>
              )}
            </>
          ) : (
            <>
              <Typography.Title level={3} className="page-title" style={{ marginBottom: 4 }}>Track my application</Typography.Title>
              <Typography.Paragraph type="secondary">Enter your application reference (LA-{new Date().getFullYear()}-0001) or licence number and the mobile number you gave when applying, on the portal or on WhatsApp.</Typography.Paragraph>
              <Card>
                <Form layout="inline" onFinish={track} initialValues={contact} style={{ gap: 8 }}>
                  <Form.Item name="ref" rules={[{ required: true, message: "Reference" }]} style={{ flex: 1, minWidth: 200 }}><Input size="large" placeholder="LA-2026-0001" /></Form.Item>
                  <Form.Item name="phone" rules={[{ required: true, message: "Phone number" }]} style={{ flex: 1, minWidth: 180 }}><Input size="large" placeholder="07xx xxx xxx" /></Form.Item>
                  <Button size="large" type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>Track</Button>
                </Form>
              </Card>
              {tracked === null && <Result status="warning" title="No application found" subTitle="Check the reference and use the same phone number you gave on the application." style={{ marginTop: 16 }} />}
              {tracked && (
                <Card style={{ marginTop: 16 }} title={<Space><span className="mono">{tracked.licenceNo || tracked.referenceNo}</span><StatusTag status={tracked.status} /></Space>}>
                  <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 0 }}>{tracked.formTitle || tracked.type}</Typography.Title>
                  <Typography.Text type="secondary">{tracked.type} · {APPLICATION_KIND_LABELS[tracked.applicationKind as ApplicationKind] || tracked.applicationKind}{tracked.legalBasis ? ` · ${tracked.legalBasis}` : ""}</Typography.Text>
                  {!closed && <Steps size="small" current={stageIndex} items={[{ title: "Submitted" }, { title: "Review" }, { title: "Inspection" }, { title: "Approved" }, { title: "Issued" }]} style={{ margin: "16px 0" }} />}
                  <Alert type={tracked.status === "ISSUED" ? "success" : tracked.canPay && tracked.payment.pending === 0 ? "warning" : "info"} showIcon title={<span><b>Next step:</b> {tracked.nextStep}</span>} style={{ marginBottom: 16 }} />
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="Applicant">{tracked.tradingName ? `${tracked.tradingName} (${tracked.applicant})` : tracked.applicant}</Descriptions.Item>
                    <Descriptions.Item label="Premises">{tracked.premises || "–"}</Descriptions.Item>
                    <Descriptions.Item label="Fee">{formatMoney(tracked.fee, tracked.currency)}{tracked.payment.settled ? <Tag color="green" style={{ marginLeft: 8 }}>Paid · receipt {tracked.receiptNo}</Tag> : tracked.payment.pending > 0 ? <Tag color="blue" style={{ marginLeft: 8 }}>Awaiting confirmation</Tag> : tracked.status === "APPROVED" ? <Tag color="gold" style={{ marginLeft: 8 }}>Due now</Tag> : null}</Descriptions.Item>
                    <Descriptions.Item label="Submitted">{formatDate(tracked.submittedAt)}</Descriptions.Item>
                    {tracked.inspectionDue && !tracked.inspectedAt && <Descriptions.Item label="Inspection" span={2}>Scheduled by {formatDate(tracked.inspectionDue)}</Descriptions.Item>}
                    {tracked.inspectedAt && <Descriptions.Item label="Inspection" span={2}><StatusTag status={tracked.inspectionOutcome || ""} /> {formatDate(tracked.inspectedAt)}</Descriptions.Item>}
                    {tracked.issuedAt && <Descriptions.Item label="Valid">{formatDate(tracked.issuedAt)} to {formatDate(tracked.expiresAt)}</Descriptions.Item>}
                    {tracked.conditions && <Descriptions.Item label="Conditions" span={2}>{tracked.conditions}</Descriptions.Item>}
                    {tracked.decisionNote && <Descriptions.Item label="Decision" span={2}>{tracked.decisionNote}</Descriptions.Item>}
                  </Descriptions>

                  {(tracked.canPay || tracked.payments.length > 0) && (
                    <div style={{ marginTop: 20 }}>
                      <Typography.Title level={5}>Payment</Typography.Title>
                      {tracked.payments.map((p) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                          <span>{formatMoney(p.amount, p.currency)} · {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] || p.method}{p.reference ? <span className="muted"> · ref {p.reference}</span> : null}<div className="muted" style={{ fontSize: 12 }}>{formatDate(p.paidAt)}{p.note ? ` · ${p.note}` : ""}</div></span>
                          <StatusTag status={p.status} labels={PAYMENT_STATUS_LABELS} />
                        </div>
                      ))}
                      {tracked.canPay && tracked.payment.pending === 0 && (
                        <Card size="small" style={{ marginTop: 12, background: "var(--layer, #f4f4f4)" }} title="I have paid the fee">
                          <Form form={payForm} layout="vertical" onFinish={submitPayment} initialValues={{ method: "ECOCASH", amount: tracked.payment.outstanding, paidAt: dayjs(), payerName: tracked.applicant }}>
                            <Row gutter={12}>
                              <Col xs={24} md={12}><Form.Item name="method" label="How did you pay?" rules={[{ required: true }]}><Select options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} /></Form.Item></Col>
                              <Col xs={24} md={12}><Form.Item name="reference" label="Receipt number or transaction reference" rules={[{ required: true, min: 3 }]}><Input placeholder="e.g. EcoCash MP240311.1234.A12345 or receipt RC-004512" /></Form.Item></Col>
                              <Col xs={12} md={8}><Form.Item name="amount" label="Amount" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: "100%" }} prefix={tracked.currency} /></Form.Item></Col>
                              <Col xs={12} md={8}><Form.Item name="paidAt" label="Date paid"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
                              <Col xs={24} md={8}><Form.Item name="payerName" label="Paid by"><Input /></Form.Item></Col>
                              <Col xs={24}><Form.Item name="proof" label="Proof of payment (optional)" valuePropName="fileList" getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}><Upload accept=".jpg,.jpeg,.png,.webp,.pdf" maxCount={1} beforeUpload={() => false}><Button icon={<UploadOutlined />}>Attach screenshot or receipt</Button></Upload></Form.Item></Col>
                            </Row>
                            <Button type="primary" htmlType="submit" loading={paying}>Send payment details</Button>
                            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Finance matches the reference against the cashbook and confirms; you will be notified and the licence is then issued.</div>
                          </Form>
                        </Card>
                      )}
                    </div>
                  )}

                  {tracked.fields.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <Typography.Title level={5}>Your answers</Typography.Title>
                      <DataView fields={tracked.fields} data={tracked.data} currency={tracked.currency} />
                    </div>
                  )}

                  {tracked.documents.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <Typography.Title level={5}>Documents</Typography.Title>
                      {tracked.documents.map((d) => {
                        const mine = tracked.attachments.filter((a) => a.label === d.name);
                        return (
                          <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                            <span>{d.received || mine.length ? <Tag color="green">Received</Tag> : <Tag>Outstanding</Tag>} {d.name}{mine.length > 0 && <span className="muted" style={{ fontSize: 12 }}> · {mine.map((m) => m.fileName).join(", ")}</span>}</span>
                            {canUpload && <Upload accept=".jpg,.jpeg,.png,.webp,.pdf" showUploadList={false} beforeUpload={(f) => { void upload(d.name, f); return false; }}><Button size="small" icon={<UploadOutlined />} loading={uploading === d.name}>{d.received || mine.length ? "Replace" : "Upload"}</Button></Upload>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Typography.Title level={5} style={{ marginTop: 20 }}>Progress</Typography.Title>
                  <Timeline items={[...tracked.timeline].reverse().map((e) => ({ color: ["REJECTED", "REVOKED", "SUSPENDED", "PAYMENT_REJECTED"].includes(e.kind) ? "red" : ["ISSUED", "APPROVED", "PAID", "PAYMENT_CONFIRMED"].includes(e.kind) ? "green" : "blue", content: <div><div>{LICENCE_EVENT_LABELS[e.kind] || e.kind}</div>{e.note && <div style={{ fontSize: 13 }}>{e.note}</div>}<div className="muted" style={{ fontSize: 12 }}>{formatDate(e.createdAt, true)}</div></div> }))} />
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </PublicShell>
  );
}

export default function VerifyPage() {
  return <Suspense fallback={null}><VerifyInner /></Suspense>;
}
