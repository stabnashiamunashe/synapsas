"use client";

import { App, Button, Card, Descriptions, Form, Input, Result, Segmented, Space, Steps, Tag, Timeline, Typography, Upload } from "antd";
import { SafetyCertificateOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { api, formatDate, formatMoney } from "@/lib/client";
import { StatusTag } from "@/components/StatusTag";
import { LICENCE_EVENT_LABELS } from "@/lib/licenceTypes";

interface Verified { licenceNo: string; type: string; category: string; holder: string; premises: string | null; status: string; issuedAt: string | null; expiresAt: string | null }
interface Tracked {
  referenceNo: string; licenceNo: string | null; status: string; statusLabel: string; nextStep: string; type: string; category: string; applicant: string; tradingName: string | null; premises: string | null;
  fee: number; currency: string; paidAt: string | null; receiptNo: string | null; issuedAt: string | null; expiresAt: string | null; inspectionDue: string | null; inspectedAt: string | null; inspectionOutcome: string | null; conditions: string | null; decisionNote: string | null; submittedAt: string;
  documents: { name: string; received: boolean }[]; attachments: { id: string; label: string | null; fileName: string; size: number; createdAt: string }[]; timeline: { kind: string; toStatus: string | null; note: string | null; createdAt: string }[]; uploadToken: string;
}

const STAGES = ["SUBMITTED", "UNDER_REVIEW", "INSPECTION", "APPROVED", "ISSUED"];

function VerifyInner() {
  const { message } = App.useApp();
  const params = useSearchParams();
  const [mode, setMode] = useState<string>(params.get("ref") ? "track" : "verify");
  const [data, setData] = useState<Verified | null | undefined>(undefined);
  const [tracked, setTracked] = useState<Tracked | null | undefined>(undefined);
  const [contact, setContact] = useState<{ ref: string; phone: string }>({ ref: params.get("ref") || "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

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
  const stageIndex = tracked ? Math.max(0, STAGES.indexOf(tracked.status === "UNDER_REVIEW" && tracked.inspectedAt ? "INSPECTION" : tracked.status)) : 0;
  const closed = tracked && ["REJECTED", "CANCELLED", "REVOKED", "EXPIRED", "SUSPENDED"].includes(tracked.status);
  const canUpload = tracked && !["ISSUED", "REJECTED", "REVOKED", "CANCELLED", "EXPIRED"].includes(tracked.status);

  return (
    <PublicShell active="verify">
      {() => (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
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
                  <Typography.Title level={5} style={{ marginTop: 0 }}>{tracked.type}</Typography.Title>
                  {!closed && <Steps size="small" current={stageIndex} items={[{ title: "Submitted" }, { title: "Review" }, { title: "Inspection" }, { title: "Approved" }, { title: "Issued" }]} style={{ margin: "12px 0 16px" }} />}
                  <Typography.Paragraph><b>Next step:</b> {tracked.nextStep}</Typography.Paragraph>
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="Applicant">{tracked.tradingName ? `${tracked.tradingName} (${tracked.applicant})` : tracked.applicant}</Descriptions.Item>
                    <Descriptions.Item label="Premises">{tracked.premises || "–"}</Descriptions.Item>
                    <Descriptions.Item label="Fee">{formatMoney(tracked.fee, tracked.currency)}{tracked.paidAt ? <Tag color="green" style={{ marginLeft: 8 }}>Paid · receipt {tracked.receiptNo}</Tag> : tracked.status === "APPROVED" ? <Tag color="gold" style={{ marginLeft: 8 }}>Due now</Tag> : null}</Descriptions.Item>
                    <Descriptions.Item label="Submitted">{formatDate(tracked.submittedAt)}</Descriptions.Item>
                    {tracked.inspectionDue && !tracked.inspectedAt && <Descriptions.Item label="Inspection" span={2}>Scheduled by {formatDate(tracked.inspectionDue)}</Descriptions.Item>}
                    {tracked.inspectedAt && <Descriptions.Item label="Inspection" span={2}><StatusTag status={tracked.inspectionOutcome || ""} /> {formatDate(tracked.inspectedAt)}</Descriptions.Item>}
                    {tracked.issuedAt && <Descriptions.Item label="Valid">{formatDate(tracked.issuedAt)} to {formatDate(tracked.expiresAt)}</Descriptions.Item>}
                    {tracked.conditions && <Descriptions.Item label="Conditions" span={2}>{tracked.conditions}</Descriptions.Item>}
                    {tracked.decisionNote && <Descriptions.Item label="Decision" span={2}>{tracked.decisionNote}</Descriptions.Item>}
                  </Descriptions>
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
                  <Timeline items={[...tracked.timeline].reverse().map((e) => ({ color: e.kind === "REJECTED" || e.kind === "REVOKED" || e.kind === "SUSPENDED" ? "red" : e.kind === "ISSUED" || e.kind === "APPROVED" || e.kind === "PAID" ? "green" : "blue", content: <div><div>{LICENCE_EVENT_LABELS[e.kind] || e.kind}</div>{e.note && <div style={{ fontSize: 13 }}>{e.note}</div>}<div className="muted" style={{ fontSize: 12 }}>{formatDate(e.createdAt, true)}</div></div> }))} />
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
