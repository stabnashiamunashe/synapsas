"use client";

import { Alert, App, Button, Card, Descriptions, Form, Input, Rate, Result, Space, Tag, Timeline, Typography } from "antd";
import { PaperClipOutlined, SearchOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { api, formatDate } from "@/lib/client";
import { CASE_STATUS_COLORS, CASE_STATUS_LABELS, type CaseStatus } from "@/lib/caseTypes";

interface Tracked {
  referenceNo: string; title: string; description: string; status: CaseStatus; priority: string; category: string | null; department: string | null; locationAddress: string | null;
  createdAt: string; updatedAt: string; slaDueAt: string | null; slaBreached: boolean; resolvedAt: string | null; closedAt: string | null; duplicateOf: string | null; rating: number | null; canRate: boolean;
  timeline: { fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string }[];
  updates: { id: string; authorName: string; body: string; createdAt: string }[];
  attachments: { id: string; fileName: string; size: number; createdAt: string }[];
}

export default function TrackPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useParams<{ ref?: string[] }>();
  const initial = params.ref?.[0] ? decodeURIComponent(params.ref[0]) : "";
  const [ref, setRef] = useState(initial);
  const [data, setData] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rated, setRated] = useState(false);

  const lookup = async (r: string) => {
    const code = r.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setError(null);
    try { setData(await api<Tracked>(`/api/public/cases/${encodeURIComponent(code)}`)); router.replace(`/track/${encodeURIComponent(code)}`); }
    catch (e) { setData(null); setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (initial) lookup(initial); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const rate = async (v: { rating: number; feedback?: string; reporterContact: string }) => {
    if (!data) return;
    try { await api(`/api/public/cases/${encodeURIComponent(data.referenceNo)}/rate`, { method: "POST", json: v }); setRated(true); message.success("Thank you for your feedback"); } catch (e) { message.error((e as Error).message); }
  };

  return (
    <PublicShell active="track">
      {() => (
        <div>
          <Typography.Title level={2} style={{ marginTop: 0 }}>Track a report</Typography.Title>
          <Card style={{ marginBottom: 16 }}>
            <Input.Search size="large" value={ref} onChange={(e) => setRef(e.target.value)} onSearch={lookup} enterButton={<Button type="primary" size="large" icon={<SearchOutlined />}>Track</Button>} placeholder="Reference number, e.g. ZS-2026-0001" className="mono" loading={loading} />
          </Card>
          {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
          {data && (
            <Card title={<Space wrap><span className="mono">{data.referenceNo}</span><Tag style={{ background: `${CASE_STATUS_COLORS[data.status]}1a`, color: CASE_STATUS_COLORS[data.status], borderColor: `${CASE_STATUS_COLORS[data.status]}55`, borderRadius: 999, fontWeight: 600 }}>{CASE_STATUS_LABELS[data.status]}</Tag></Space>}>
              <Typography.Title level={4} style={{ marginTop: 0 }}>{data.title}</Typography.Title>
              <Typography.Paragraph>{data.description}</Typography.Paragraph>
              <Descriptions size="small" column={{ xs: 1, md: 2 }} items={[
                { key: "c", label: "Category", children: data.category || "–" }, { key: "d", label: "Handled by", children: data.department || "–" },
                { key: "l", label: "Location", children: data.locationAddress || "–" }, { key: "s", label: "Logged", children: formatDate(data.createdAt, true) },
                { key: "sla", label: "Target", children: data.slaDueAt ? <span>{formatDate(data.slaDueAt, true)} {data.slaBreached && <Tag color="red">overdue</Tag>}</span> : "–" },
                { key: "r", label: data.resolvedAt ? "Resolved" : "Last activity", children: formatDate(data.resolvedAt || data.updatedAt, true) },
                ...(data.duplicateOf ? [{ key: "dup", label: "Handled under", children: <a href={`/track/${data.duplicateOf}`} className="mono">{data.duplicateOf}</a> }] : []),
              ]} />
              <Typography.Title level={5} style={{ marginTop: 20 }}>Progress</Typography.Title>
              <Timeline items={[
                ...data.timeline.map((t, i) => ({ key: `t${i}`, color: CASE_STATUS_COLORS[t.toStatus as CaseStatus], content: <div><b>{CASE_STATUS_LABELS[t.toStatus as CaseStatus] || t.toStatus}</b> <span className="muted">· {formatDate(t.createdAt, true)}</span>{t.reason && <div className="muted">{t.reason}</div>}</div> })),
                ...data.updates.map((u) => ({ key: u.id, color: "blue", content: <div style={{ background: "#f3f6ff", borderRadius: 8, padding: "8px 12px" }}><b>{u.authorName}</b> <span className="muted">· {formatDate(u.createdAt, true)}</span><div style={{ whiteSpace: "pre-wrap" }}>{u.body}</div></div> })),
              ].sort((a, b) => {
                const at = (x: { key: string }) => (x.key.startsWith("t") ? data.timeline[Number(x.key.slice(1))]?.createdAt : data.updates.find((u) => u.id === x.key)?.createdAt) || "";
                return at(a).localeCompare(at(b));
              })} />
              {data.attachments.length > 0 && <div><Typography.Text strong>Files</Typography.Text>{data.attachments.map((a) => <div key={a.id}><PaperClipOutlined /> {a.fileName} <span className="muted">({Math.round(a.size / 1024)} KB)</span></div>)}</div>}
              {data.canRate && !rated && !data.rating && (
                <Card size="small" title="How did we do?" style={{ marginTop: 16 }}>
                  <Form layout="vertical" onFinish={rate} initialValues={{ rating: 5 }}>
                    <Form.Item name="rating" label="Rating" rules={[{ required: true }]}><Rate /></Form.Item>
                    <Form.Item name="feedback" label="Comments"><Input.TextArea autoSize={{ minRows: 2 }} /></Form.Item>
                    <Form.Item name="reporterContact" label="The phone number or email you reported with" rules={[{ required: true }]} extra="Used only to confirm it is your report."><Input /></Form.Item>
                    <Button type="primary" htmlType="submit">Send feedback</Button>
                  </Form>
                </Card>
              )}
              {(rated || data.rating) && <Result status="success" title="Thank you for your feedback" style={{ padding: 12 }} />}
            </Card>
          )}
        </div>
      )}
    </PublicShell>
  );
}
