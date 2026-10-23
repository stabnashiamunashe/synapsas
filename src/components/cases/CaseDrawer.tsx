"use client";

import { App, Avatar, Button, Descriptions, Divider, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Rate, Select, Space, Switch, Tabs, Tag, Timeline, Typography, Upload } from "antd";
import { LinkOutlined, PaperClipOutlined, SendOutlined, UploadOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { api, formatDate, useApi, useMe } from "@/lib/client";
import { CASE_PRIORITIES, CASE_PRIORITY_LABELS, CASE_STATUSES, CASE_STATUS_COLORS, CASE_STATUS_LABELS, CASE_TRANSITIONS, type CaseStatus } from "@/lib/caseTypes";
import { PriorityDot, SlaBadge, StatusPill, type CaseListItem } from "./CaseBits";

interface CaseDetail extends CaseListItem {
  reporter?: { id: string; name: string; email: string } | null;
  duplicateOf?: { id: string; referenceNo: string; title: string } | null;
  duplicates: { id: string; referenceNo: string; title: string }[];
  events: { id: string; fromStatus: string | null; toStatus: string; changedByName: string; reason: string | null; createdAt: string }[];
  comments: { id: string; authorName: string; body: string; isInternal: boolean; createdAt: string; user?: { id: string; name: string; avatarUrl?: string | null } | null }[];
  attachments: { id: string; fileName: string; mimeType: string; size: number; isPublic: boolean; stage: string; uploadedBy: string; createdAt: string }[];
  canEditRouting: boolean; canLinkDuplicate: boolean;
}
type Opt = { id: string; name: string };

export function CaseDrawer({ id, onClose, onChanged, requireReason }: { id: string | null; onClose: () => void; onChanged: () => void; requireReason?: boolean }) {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const { data: c, mutate, isLoading } = useApi<CaseDetail>(id ? `/api/cases/${id}` : null);
  const { data: departments } = useApi<Opt[]>(id ? "/api/departments" : null);
  const { data: categories } = useApi<(Opt & { departmentId: string })[]>(id ? "/api/case-categories" : null);
  const { data: users } = useApi<(Opt & { departmentId?: string | null; role: string })[]>(id ? "/api/users" : null);
  const { data: projects } = useApi<{ id: string; code: string; name: string }[]>(id ? "/api/projects" : null);
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(true);
  const [reasonFor, setReasonFor] = useState<CaseStatus | null>(null);
  const [reason, setReason] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkRef, setLinkRef] = useState("");
  const [tab, setTab] = useState("activity");
  useEffect(() => { setTab("activity"); setComment(""); }, [id]);

  const refresh = async () => { await mutate(); onChanged(); };
  const handle = (e: unknown) => {
    const err = e as { status?: number; message: string };
    if (err.status === 409) { message.warning("Someone else changed this case. Reloaded."); mutate(); } else message.error(err.message);
  };
  const patch = async (data: Record<string, unknown>) => {
    if (!c) return;
    try { await api(`/api/cases/${c.id}`, { method: "PATCH", json: { version: c.version, ...data } }); await refresh(); } catch (e) { handle(e); }
  };
  const move = async (status: CaseStatus, why?: string) => {
    if (!c) return;
    try { await api(`/api/cases/${c.id}/status`, { method: "POST", json: { version: c.version, status, reason: why || undefined } }); setReasonFor(null); setReason(""); await refresh(); } catch (e) { handle(e); }
  };
  const nextStatuses = useMemo(() => {
    if (!c) return [] as CaseStatus[];
    const admin = me?.user.role === "OWNER" || me?.user.role === "ADMIN";
    return admin ? CASE_STATUSES.filter((s) => s !== c.status) : CASE_TRANSITIONS[c.status] || [];
  }, [c, me]);
  const send = async () => {
    if (!c || !comment.trim()) return;
    try { await api(`/api/cases/${c.id}/comments`, { method: "POST", json: { body: comment.trim(), isInternal: internal } }); setComment(""); await refresh(); } catch (e) { handle(e); }
  };
  const upload = async (file: File) => {
    if (!c) return false;
    const fd = new FormData(); fd.append("file", file); fd.append("stage", ["RESOLVED", "CLOSED"].includes(c.status) ? "COMPLETION_PROOF" : "IN_PROGRESS");
    try { await api(`/api/cases/${c.id}/attachments`, { method: "POST", body: fd }); message.success("Uploaded"); await refresh(); } catch (e) { handle(e); }
    return false;
  };
  const catOptions = (categories || []).filter((x) => !c?.departmentId || x.departmentId === c.departmentId);
  const userOptions = (users || []).filter((u) => !c?.departmentId || u.departmentId === c.departmentId || u.role !== "MEMBER");

  return (
    <Drawer open={!!id} onClose={onClose} size={720} styles={{ body: { padding: 0 } }} title={c ? <Space wrap><span className="mono muted">{c.referenceNo}</span><StatusPill status={c.status} /><SlaBadge c={c} /></Space> : "Loading…"}>
      {!c ? <div style={{ padding: 24 }}>{isLoading ? "Loading…" : <Empty />}</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", height: "100%" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #eef0f3" }}>
            <Typography.Title level={4} style={{ margin: 0 }} editable={{ onChange: (v) => v && v !== c.title && patch({ title: v }) }}>{c.title}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: "6px 0 10px" }} editable={{ onChange: (v) => v && v !== c.description && patch({ description: v }) }}>{c.description}</Typography.Paragraph>
            <Space wrap size={[8, 8]}>
              <Select size="small" value={c.status} style={{ width: 170 }} onChange={(s) => (requireReason ? setReasonFor(s) : move(s))}
                options={[{ value: c.status, label: <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 8, background: CASE_STATUS_COLORS[c.status], marginRight: 6 }} />{CASE_STATUS_LABELS[c.status]}</span> }, ...nextStatuses.map((s) => ({ value: s, label: <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 8, background: CASE_STATUS_COLORS[s], marginRight: 6 }} />{CASE_STATUS_LABELS[s]}</span> }))]} />
              <Select size="small" value={c.priority} style={{ width: 130 }} onChange={(p) => patch({ priority: p })} options={CASE_PRIORITIES.map((p) => ({ value: p, label: <PriorityDot priority={p} withLabel /> }))} />
              <Select size="small" value={c.assigneeId || undefined} placeholder="Unassigned" allowClear showSearch optionFilterProp="label" style={{ width: 200 }} disabled={!c.canEditRouting} onChange={(v) => patch({ assigneeId: v || null })} options={userOptions.map((u) => ({ value: u.id, label: u.name }))} />
              {c.canLinkDuplicate && !c.isDuplicate && <Button size="small" icon={<LinkOutlined />} onClick={() => setLinkOpen(true)}>Duplicate of…</Button>}
            </Space>
          </div>
          <Tabs activeKey={tab} onChange={setTab} style={{ padding: "0 24px" }} items={[
            { key: "activity", label: `Activity (${c.events.length + c.comments.length})`, children: (
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
                  <Input.TextArea value={comment} onChange={(e) => setComment(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} placeholder={internal ? "Internal note (staff only)" : "Public update (emailed to the reporter and shown on the tracking page)"} onPressEnter={(e) => { if (e.ctrlKey || e.metaKey) send(); }} />
                  <Space orientation="vertical" size={4}>
                    <Button type="primary" icon={<SendOutlined />} onClick={send} disabled={!comment.trim()}>Post</Button>
                    <span style={{ fontSize: 12 }}><Switch size="small" checked={!internal} onChange={(v) => setInternal(!v)} /> Public</span>
                  </Space>
                </div>
                <Timeline items={[...c.events.map((e) => ({ key: e.id, kind: "event" as const, at: e.createdAt, e })), ...c.comments.map((m) => ({ key: m.id, kind: "comment" as const, at: m.createdAt, m }))]
                  .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                  .map((it) => it.kind === "event" ? {
                    key: it.key, color: CASE_STATUS_COLORS[it.e.toStatus as CaseStatus],
                    content: <div><b>{it.e.fromStatus && it.e.fromStatus !== it.e.toStatus ? `${CASE_STATUS_LABELS[it.e.fromStatus as CaseStatus] || it.e.fromStatus} → ` : ""}{CASE_STATUS_LABELS[it.e.toStatus as CaseStatus] || it.e.toStatus}</b> <span className="muted">· {it.e.changedByName} · {formatDate(it.e.createdAt, true)}</span>{it.e.reason && <div className="muted">{it.e.reason}</div>}</div>,
                  } : {
                    key: it.key, icon: <Avatar size={22} src={it.m.user?.avatarUrl || undefined} style={{ background: it.m.isInternal ? "#8a94a6" : "var(--brand-color)", fontSize: 11 }}>{it.m.authorName.slice(0, 1)}</Avatar>,
                    content: <div style={{ background: it.m.isInternal ? "#fff8e6" : "#f3f6ff", border: "1px solid #eef0f3", borderRadius: 8, padding: "8px 12px" }}><div style={{ fontSize: 12 }}><b>{it.m.authorName}</b> <Tag style={{ marginLeft: 6 }} color={it.m.isInternal ? "gold" : "blue"}>{it.m.isInternal ? "internal note" : "public update"}</Tag><span className="muted"> {formatDate(it.m.createdAt, true)}</span></div><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{it.m.body}</div></div>,
                  })} />
              </div>
            ) },
            { key: "details", label: "Details", children: (
              <Form layout="vertical" size="small">
                <Descriptions size="small" column={1} bordered items={[
                  { key: "d", label: "Section", children: <Select value={c.departmentId || undefined} allowClear style={{ width: "100%" }} disabled={!c.canEditRouting} onChange={(v) => patch({ departmentId: v || null })} options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} /> },
                  { key: "c", label: "Category", children: <Select value={c.categoryId || undefined} allowClear style={{ width: "100%" }} onChange={(v) => patch({ categoryId: v || null })} options={catOptions.map((x) => ({ value: x.id, label: x.name }))} /> },
                  { key: "p", label: "Project / survey", children: <Select value={c.projectId || undefined} allowClear showSearch optionFilterProp="label" style={{ width: "100%" }} onChange={(v) => patch({ projectId: v || null })} options={(projects || []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} /> },
                  { key: "s", label: "SLA target (hours)", children: <InputNumber min={1} value={c.slaHours} disabled={!c.canEditRouting} onChange={(v) => v && v !== c.slaHours && patch({ slaHours: v })} /> },
                  { key: "due", label: "SLA due", children: c.slaDueAt ? formatDate(c.slaDueAt, true) : "–" },
                  { key: "r", label: "Reporter", children: <span>{c.reporterName}{c.reporterPhone ? ` · ${c.reporterPhone}` : ""}{c.reporterEmail ? ` · ${c.reporterEmail}` : ""} <Tag style={{ marginLeft: 6 }}>{c.source.toLowerCase().replace("_", " ")}</Tag></span> },
                  { key: "l", label: "Location", children: <Input value={c.locationAddress || ""} placeholder="Address / office / site" onBlur={(e) => e.target.value !== (c.locationAddress || "") && patch({ locationAddress: e.target.value || null })} onChange={() => undefined} suffix={c.latitude && c.longitude ? <a href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}`} target="_blank" rel="noreferrer">map</a> : undefined} /> },
                  { key: "o", label: "Office / station", children: c.office || "–" },
                  { key: "created", label: "Logged", children: `${formatDate(c.createdAt, true)}${c.resolvedAt ? ` · resolved ${formatDate(c.resolvedAt, true)}` : ""}${c.closedAt ? ` · closed ${formatDate(c.closedAt, true)}` : ""}` },
                  ...(c.duplicateOf ? [{ key: "dup", label: "Duplicate of", children: <span className="mono">{c.duplicateOf.referenceNo}</span> }] : []),
                  ...(c.duplicates.length ? [{ key: "dups", label: "Duplicates", children: c.duplicates.map((d) => <Tag key={d.id} className="mono">{d.referenceNo}</Tag>) }] : []),
                  ...(c.rating ? [{ key: "rating", label: "Reporter rating", children: <span><Rate disabled value={c.rating} /> {c.feedback && <div className="muted">{c.feedback}</div>}</span> }] : []),
                ]} />
              </Form>
            ) },
            { key: "files", label: `Files (${c.attachments.length})`, children: (
              <div>
                <Upload beforeUpload={upload} showUploadList={false} multiple><Button icon={<UploadOutlined />}>Upload</Button></Upload>
                <Divider style={{ margin: "12px 0" }} />
                {c.attachments.length === 0 && <Empty description="No files" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                {c.attachments.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f0f2f5" }}>
                    <PaperClipOutlined />
                    <a href={`/api/case-attachments/${a.id}`} style={{ flex: 1 }}>{a.fileName}</a>
                    <span className="muted" style={{ fontSize: 12 }}>{Math.round(a.size / 1024)} KB · {a.stage.toLowerCase().replace("_", " ")} · {a.uploadedBy}</span>
                    <Switch size="small" checked={a.isPublic} checkedChildren="public" unCheckedChildren="staff" onChange={async (v) => { await api(`/api/case-attachments/${a.id}`, { method: "PATCH", json: { isPublic: v } }); mutate(); }} />
                    <Popconfirm title="Remove file?" onConfirm={async () => { await api(`/api/case-attachments/${a.id}`, { method: "DELETE" }); mutate(); }}><a style={{ color: "#c53030" }}>remove</a></Popconfirm>
                  </div>
                ))}
              </div>
            ) },
          ]} />
        </div>
      )}
      <Modal open={!!reasonFor} title={`Move to ${reasonFor ? CASE_STATUS_LABELS[reasonFor] : ""}`} onCancel={() => setReasonFor(null)} onOk={() => reasonFor && move(reasonFor, reason)} okText="Update">
        <Input.TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this change (recorded in the timeline)" autoSize={{ minRows: 2 }} />
      </Modal>
      <Modal open={linkOpen} title="Mark as duplicate" onCancel={() => setLinkOpen(false)} okText="Link and reject" onOk={async () => {
        if (!c) return;
        const list = await api<{ items: CaseListItem[] }>(`/api/cases?q=${encodeURIComponent(linkRef.trim())}&pageSize=5`);
        const orig = list.items.find((x) => x.referenceNo.toUpperCase() === linkRef.trim().toUpperCase() && x.id !== c.id);
        if (!orig) return message.error("No other case with that reference");
        try { await api(`/api/cases/${c.id}/link-duplicate`, { method: "POST", json: { originalId: orig.id } }); setLinkOpen(false); setLinkRef(""); await refresh(); } catch (e) { handle(e); }
      }}>
        <Typography.Paragraph type="secondary">This case will be rejected and linked to the original. The reporter is told which case is being handled.</Typography.Paragraph>
        <Input value={linkRef} onChange={(e) => setLinkRef(e.target.value)} placeholder="Original reference, e.g. ZS-2026-0001" className="mono" />
      </Modal>
    </Drawer>
  );
}
