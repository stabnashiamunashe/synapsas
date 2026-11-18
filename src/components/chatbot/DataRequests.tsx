"use client";

import { App, Button, Card, Descriptions, Drawer, Empty, Input, Modal, Segmented, Space, Table, Tag, Timeline, Tooltip, Typography } from "antd";
import { CheckOutlined, CloseOutlined, DownloadOutlined, PaperClipOutlined, SendOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, downloadUrl, formatDate, timeAgo, useApi } from "@/lib/client";
import { StatusPill } from "@/components/cases/CaseBits";
import type { CaseStatus } from "@/lib/caseTypes";

type Bucket = "pending" | "approved" | "delivered" | "declined";
interface Req { requesterType: string; organisation: string; email: string; topic: string; geo: string; period: string; format: string; purpose: string; description: string; decision: { status: string; by: string; at: string; note: string | null } | null }
interface Row { id: string; referenceNo: string; title: string; status: string; bucket: Bucket; reporterName: string; reporterEmail: string | null; phone: string | null; assignee: { name: string } | null; attachments: number; createdAt: string; slaDueAt: string | null; request: Req }
interface ListResp { items: Row[]; counts: Record<Bucket, number>; canDecide: boolean }
interface Detail extends Omit<Row, "attachments"> { description: string; resolvedAt: string | null; comments: { id: string; body: string; isInternal: boolean; fromStaff: boolean; authorName: string; createdAt: string }[]; attachments: { id: string; fileName: string; size: number }[]; events: { id: string; toStatus: string; changedByName: string; reason: string | null; createdAt: string }[]; canDecide: boolean }

type TItem = { key: string; at: string; color: string; content: React.ReactNode };

const BUCKET_LABEL: Record<Bucket, string> = { pending: "Pending", approved: "Approved", delivered: "Delivered", declined: "Declined" };
const BUCKET_COLOR: Record<Bucket, string> = { pending: "gold", approved: "blue", delivered: "green", declined: "red" };

/** Data requests lodged on WhatsApp (DR- cases): review the answers, approve or decline, mark as delivered. */
export function DataRequests({ onChanged }: { onChanged: () => void }) {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [bucket, setBucket] = useState<Bucket | "all">("pending");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const [decide, setDecide] = useState<{ action: "approve" | "decline" | "deliver" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, mutate, isLoading } = useApi<ListResp>(`/api/chatbot/data-requests?status=${bucket}${q ? `&q=${encodeURIComponent(q)}` : ""}`, { refreshInterval: 30000 });
  const { data: d, mutate: mutateDetail } = useApi<Detail>(open ? `/api/chatbot/data-requests/${open}` : null);
  const show = (id: string | null) => { setOpen(id); router.replace(id ? `/app/chatbot?tab=requests&open=${id}` : "/app/chatbot?tab=requests"); };

  const submit = async () => {
    if (!d || !decide) return;
    if (decide.action === "decline" && !note.trim()) return message.warning("Give the requester the reason");
    setBusy(true);
    try {
      await api(`/api/chatbot/data-requests/${d.id}`, { method: "POST", json: { action: decide.action, note: note.trim() || undefined } });
      message.success(decide.action === "approve" ? `${d.referenceNo} approved; the requester has been told.` : decide.action === "decline" ? `${d.referenceNo} declined; the requester has been told.` : `${d.referenceNo} marked as delivered.`);
      setDecide(null); setNote("");
      await Promise.all([mutate(), mutateDetail()]); onChanged();
    } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };

  const actions = d && d.canDecide && (
    <Space wrap>
      {d.bucket === "pending" && <Button type="primary" icon={<CheckOutlined />} onClick={() => setDecide({ action: "approve" })}>Approve</Button>}
      {(d.bucket === "pending" || d.bucket === "approved") && <Button icon={<SendOutlined />} onClick={() => setDecide({ action: "deliver" })}>Mark as delivered</Button>}
      {d.bucket !== "declined" && d.bucket !== "delivered" && <Button danger icon={<CloseOutlined />} onClick={() => setDecide({ action: "decline" })}>Decline</Button>}
    </Space>
  );

  return (
    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
      <Card size="small">
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            <Segmented value={bucket} onChange={(v) => setBucket(v as Bucket | "all")} options={[
              ...(["pending", "approved", "delivered", "declined"] as Bucket[]).map((b) => ({ value: b, label: `${BUCKET_LABEL[b]}${data ? ` (${data.counts[b]})` : ""}` })),
              { value: "all", label: "All" },
            ]} />
            <Input.Search allowClear placeholder="Reference, requester, organisation, text" style={{ width: 280 }} onSearch={setQ} />
          </Space>
          {data?.canDecide && <Button icon={<DownloadOutlined />} onClick={() => downloadUrl(`/api/chatbot/data-requests?status=${bucket}&format=csv`)}>CSV</Button>}
        </Space>
      </Card>
      <Table<Row> rowKey="id" size="small" loading={isLoading && !data} dataSource={data?.items || []} pagination={{ pageSize: 25, hideOnSinglePage: true }} onRow={(r) => ({ onClick: () => show(r.id), style: { cursor: "pointer" } })} scroll={{ x: 1000 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={bucket === "pending" ? "Nothing waiting for a decision" : "No data requests here"} /> }}
        columns={[
          { title: "Ref", dataIndex: "referenceNo", width: 130, render: (v) => <span className="mono">{v}</span> },
          { title: "Lodged", dataIndex: "createdAt", width: 110, render: (v) => <Tooltip title={formatDate(v, true)}>{timeAgo(v)}</Tooltip>, sorter: (a, b) => a.createdAt.localeCompare(b.createdAt) },
          { title: "Requester", width: 200, render: (_, r) => <span>{r.reporterName}<div className="muted" style={{ fontSize: 11 }}>{r.request.requesterType}{r.request.organisation ? ` · ${r.request.organisation}` : ""}</div></span> },
          { title: "Data needed", ellipsis: true, render: (_, r) => r.request.description || r.title },
          { title: "Subject area", width: 150, render: (_, r) => r.request.topic },
          { title: "Period", width: 110, render: (_, r) => r.request.period },
          { title: "Format", width: 90, render: (_, r) => r.request.format },
          { title: "Decision", width: 130, render: (_, r) => <Tag color={BUCKET_COLOR[r.bucket]}>{BUCKET_LABEL[r.bucket]}</Tag> },
          { title: "Assignee", width: 140, render: (_, r) => r.assignee?.name || <span className="muted">–</span> },
        ]} />

      <Drawer open={!!open} onClose={() => show(null)} size={720} title={d ? <Space wrap><span className="mono">{d.referenceNo}</span><StatusPill status={d.status as CaseStatus} /><Tag color={BUCKET_COLOR[d.bucket]}>{BUCKET_LABEL[d.bucket]}</Tag></Space> : "Data request"} extra={actions}>
        {d && (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            {d.request.decision && <Card size="small" style={{ background: d.bucket === "declined" ? "#fff1f0" : "#f6ffed" }}><b>{d.request.decision.status.toLowerCase().replace(/^\w/, (m) => m.toUpperCase())}</b> by {d.request.decision.by} on {formatDate(d.request.decision.at, true)}{d.request.decision.note ? <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{d.request.decision.note}</div> : null}</Card>}
            <Descriptions size="small" column={2} bordered items={[
              { key: "who", label: "Requester", children: d.reporterName },
              { key: "type", label: "Type", children: d.request.requesterType || "–" },
              { key: "org", label: "Organisation", children: d.request.organisation || "–" },
              { key: "email", label: "Email", children: d.reporterEmail ? <a href={`mailto:${d.reporterEmail}`}>{d.reporterEmail}</a> : "–" },
              { key: "phone", label: "WhatsApp", children: <span className="mono">{d.phone || "–"}</span> },
              { key: "lodged", label: "Lodged", children: formatDate(d.createdAt, true) },
              { key: "topic", label: "Subject area", children: d.request.topic || "–" },
              { key: "geo", label: "Geographic level", children: d.request.geo || "–" },
              { key: "period", label: "Period", children: d.request.period || "–" },
              { key: "format", label: "Preferred format", children: d.request.format || "–" },
              { key: "purpose", label: "Purpose", children: d.request.purpose || "–" },
              { key: "sla", label: "Due", children: d.slaDueAt ? formatDate(d.slaDueAt, true) : "–" },
              { key: "desc", label: "Data needed", span: 2, children: <div style={{ whiteSpace: "pre-wrap" }}>{d.request.description || d.title}</div> },
            ]} />
            {Array.isArray(d.attachments) && d.attachments.length > 0 && <div>{d.attachments.map((a) => <div key={a.id}><PaperClipOutlined /> <a href={`/api/case-attachments/${a.id}`}>{a.fileName}</a> <span className="muted" style={{ fontSize: 11 }}>{Math.max(1, Math.round(a.size / 1024))} KB</span></div>)}</div>}
            <div>
              <Typography.Text strong>Conversation and timeline</Typography.Text>
              <Timeline style={{ marginTop: 12 }} items={([
                ...d.events.map((e): TItem => ({ key: e.id, at: e.createdAt, color: "gray", content: <div><span>{e.changedByName}: <StatusPill status={e.toStatus as CaseStatus} />{e.reason ? ` ${e.reason}` : ""}</span><div className="muted" style={{ fontSize: 11 }}>{formatDate(e.createdAt, true)}</div></div> })),
                ...d.comments.map((m): TItem => ({ key: m.id, at: m.createdAt, color: m.isInternal ? "gold" : "blue", content: <div style={{ background: m.isInternal ? "#fff8e6" : "#f3f6ff", borderRadius: 8, padding: "6px 10px" }}><b>{m.authorName}</b> <Tag color={m.isInternal ? "gold" : "blue"}>{m.isInternal ? "internal note" : m.fromStaff ? "sent to requester" : "from requester"}</Tag><span className="muted" style={{ fontSize: 11 }}> {formatDate(m.createdAt, true)}</span><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{m.body}</div></div> })),
              ] as TItem[]).sort((a, b) => a.at.localeCompare(b.at)).map((it) => ({ key: it.key, color: it.color, content: it.content }))} />
            </div>
            <a href={`/app/cases?open=${d.id}`} target="_blank" rel="noreferrer">Open as a case (assign, notes, attachments) ↗</a>
          </Space>
        )}
      </Drawer>

      <Modal open={!!decide} onCancel={() => { setDecide(null); setNote(""); }} onOk={submit} confirmLoading={busy} okText={decide?.action === "approve" ? "Approve and notify" : decide?.action === "decline" ? "Decline and notify" : "Mark as delivered"} okButtonProps={{ danger: decide?.action === "decline" }}
        title={decide?.action === "approve" ? `Approve ${d?.referenceNo}` : decide?.action === "decline" ? `Decline ${d?.referenceNo}` : `Mark ${d?.referenceNo} as delivered`}>
        <Typography.Paragraph type="secondary">
          {decide?.action === "approve" && "The requester is told on WhatsApp (and by email) that the request is approved and being prepared. The case moves to In progress."}
          {decide?.action === "decline" && "The requester is told on WhatsApp (and by email) with your reason. The case is rejected."}
          {decide?.action === "deliver" && "The requester is told the data has been sent. Say where (email, link) if useful. The case is resolved."}
        </Typography.Paragraph>
        <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} autoSize={{ minRows: 3 }} placeholder={decide?.action === "decline" ? "Reason (required; sent to the requester)" : "Note to the requester (optional)"} />
      </Modal>
    </Space>
  );
}
