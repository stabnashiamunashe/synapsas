"use client";

import { Alert, App, Button, Card, Col, DatePicker, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Skeleton, Space, Switch, Table, Tag, Timeline, Tooltip, Typography, Upload } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, ClockCircleOutlined, DownloadOutlined, FileTextOutlined, InboxOutlined, LockOutlined, PaperClipOutlined, PlusOutlined, SearchOutlined, SendOutlined, SettingOutlined, UploadOutlined, UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatCard } from "@/components/StatCard";
import { PriorityTag, StatusTag } from "@/components/StatusTag";
import { api, downloadUrl, formatDate, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";
import { DOC_TYPES, DOC_TYPE_LABELS, EVENT_LABELS, IN_STATUSES, METHODS, METHOD_LABELS, OUT_STATUSES, RECORD_DONE, RECORD_STATUS_LABELS, type Direction } from "@/lib/recordTypes";

interface Named { id: string; name: string; code?: string | null; departmentId?: string | null }
interface FileRef { id: string; fileNo: string; title: string; status?: string }
interface Rec {
  id: string; referenceNo: string; direction: Direction; docType: string; subject: string; summary?: string | null; party: string; contactName?: string | null; contactDetails?: string | null; theirRef?: string | null;
  letterDate?: string | null; dateLogged: string; method: string; status: string; priority: string; confidential: boolean; pages?: number | null; enclosures?: string | null; actionRequired?: string | null; actionDue?: string | null;
  relatedRef?: string | null; dispatchedById?: string | null; trackingNo?: string | null; signedBy?: string | null; filedAt?: string | null; repliedAt?: string | null; overdue: boolean;
  file?: FileRef | null; department?: Named | null; assignedTo?: Named | null; registeredBy?: Named | null; replyTo?: { id: string; referenceNo: string; subject: string } | null; _count: { attachments: number; replies: number };
}
interface Detail extends Rec {
  replies: { id: string; referenceNo: string; subject: string; status: string; dateLogged: string }[];
  events: { id: string; kind: string; note?: string | null; createdAt: string; actor?: { name: string } | null; toUserId?: string | null }[];
  attachments: { id: string; label?: string | null; fileName: string; size: number; createdAt: string; uploader?: { name: string } | null }[];
}
interface Resp { items: Rec[]; counts: Record<string, number>; access: { canRegister: boolean; isClerk: boolean; departmentId: string | null } }
type Scope = "all" | "IN" | "OUT" | "mine" | "overdue";

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dateStr = (v?: dayjs.Dayjs | null) => (v ? v.format("YYYY-MM-DD") : null);

function DirectionIcon({ d }: { d: Direction }) {
  return d === "IN" ? <Tooltip title="Incoming"><ArrowDownOutlined style={{ color: "#0f62fe" }} /></Tooltip> : <Tooltip title="Outgoing"><ArrowUpOutlined style={{ color: "#198038" }} /></Tooltip>;
}

function Due({ r }: { r: Rec }) {
  if (!r.actionDue || RECORD_DONE.includes(r.status as never)) return null;
  const days = dayjs(r.actionDue).startOf("day").diff(dayjs().startOf("day"), "day");
  const text = days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`;
  return <div style={{ fontSize: 12, color: r.overdue ? "#da1e28" : days <= 1 ? "#b28600" : undefined }}><ClockCircleOutlined /> {text}</div>;
}

/** Register / edit form shared by incoming, outgoing and reply. */
function RecordFields({ direction, form, users, departments, files, incoming, editing, me }: { direction: Direction; form: ReturnType<typeof Form.useForm>[0]; users: Named[]; departments: Named[]; files: FileRef[]; incoming: Rec[]; editing: boolean; me?: { departmentId?: string | null } }) {
  const dept = Form.useWatch("departmentId", form);
  const officerOptions = users.filter((u) => !dept || u.departmentId === dept).map((u) => ({ value: u.id, label: u.name }));
  const dispatched = Form.useWatch("dispatched", form);
  return (
    <Row gutter={12}>
      <Col span={8}><Form.Item name="docType" label="Document type" rules={[{ required: true }]}><Select options={DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABELS[t] }))} /></Form.Item></Col>
      <Col span={8}><Form.Item name="dateLogged" label={direction === "IN" ? "Date received" : dispatched === false ? "Date registered" : "Date dispatched"} rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
      <Col span={8}><Form.Item name="method" label={direction === "IN" ? "Received by" : "Sent by"} rules={[{ required: true }]}><Select options={METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))} /></Form.Item></Col>
      <Col span={24}><Form.Item name="subject" label="Subject" rules={[{ required: true, min: 3 }]}><Input placeholder={direction === "IN" ? "e.g. Request for approval of 2026 supplementary budget" : "e.g. Response to audit query on fuel usage"} /></Form.Item></Col>
      <Col span={12}><Form.Item name="party" label={direction === "IN" ? "From (organisation or person)" : "To (organisation or person)"} rules={[{ required: true, min: 2 }]}><Input placeholder="e.g. Ministry of Local Government and Public Works" /></Form.Item></Col>
      <Col span={6}><Form.Item name="contactName" label="Contact person"><Input /></Form.Item></Col>
      <Col span={6}><Form.Item name="contactDetails" label="Phone / email / address"><Input /></Form.Item></Col>
      <Col span={8}><Form.Item name="theirRef" label="Their reference"><Input placeholder="e.g. MLG/12/4/2026" /></Form.Item></Col>
      <Col span={8}><Form.Item name="letterDate" label="Date on the document"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
      <Col span={8}><Form.Item name="priority" label="Priority"><Select options={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => ({ value: p, label: p[0] + p.slice(1).toLowerCase() }))} /></Form.Item></Col>
      <Col span={12}><Form.Item name="fileId" label="File (file plan)"><Select allowClear showSearch optionFilterProp="label" placeholder="Place on a file now or when filing" options={files.map((f) => ({ value: f.id, label: `${f.fileNo} · ${f.title}` }))} /></Form.Item></Col>
      <Col span={12}><Form.Item name="relatedRef" label="Related case / licence / request"><Input placeholder="e.g. LA-2026-0006 or RLB-0042" /></Form.Item></Col>
      {direction === "IN" ? (
        <>
          <Col span={12}><Form.Item name="departmentId" label="Route to department"><Select allowClear showSearch optionFilterProp="label" options={departments.map((d) => ({ value: d.id, label: d.name }))} onChange={() => form.setFieldValue("assignedToId", undefined)} /></Form.Item></Col>
          <Col span={12}><Form.Item name="assignedToId" label="Action officer"><Select allowClear showSearch optionFilterProp="label" placeholder="Head of department if left blank" options={officerOptions} /></Form.Item></Col>
          <Col span={16}><Form.Item name="actionRequired" label="Action required"><Input placeholder="e.g. Draft reply for the Town Clerk's signature" /></Form.Item></Col>
          <Col span={8}><Form.Item name="actionDue" label="Reply / action by" extra={editing ? undefined : "Defaults to the standard reply time"}><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
        </>
      ) : (
        <>
          {!editing && <Col span={12}><Form.Item name="replyToId" label="In reply to (incoming item)"><Select allowClear showSearch optionFilterProp="label" placeholder="Optional" options={incoming.map((r) => ({ value: r.id, label: `${r.referenceNo} · ${r.subject}` }))} /></Form.Item></Col>}
          <Col span={12}><Form.Item name="signedBy" label="Signed by"><Input placeholder="e.g. Town Clerk" /></Form.Item></Col>
          {!editing && <Col span={8}><Form.Item name="dispatched" label="Already dispatched" valuePropName="checked" extra="Off = register a letter awaiting signature or the messenger"><Switch /></Form.Item></Col>}
          <Col span={8}><Form.Item name="dispatchedById" label="Dispatched by (messenger / courier)"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="trackingNo" label="Tracking / registered post no"><Input /></Form.Item></Col>
          {me?.departmentId === undefined ? null : <Col span={12}><Form.Item name="departmentId" label="Originating department"><Select allowClear showSearch optionFilterProp="label" options={departments.map((d) => ({ value: d.id, label: d.name }))} /></Form.Item></Col>}
        </>
      )}
      <Col span={6}><Form.Item name="pages" label="Pages"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
      <Col span={12}><Form.Item name="enclosures" label="Enclosures"><Input placeholder="e.g. 2 annexures, cheque" /></Form.Item></Col>
      <Col span={6}><Form.Item name="confidential" label="Confidential" valuePropName="checked" extra="Only registry, the action officer and heads can see it"><Switch /></Form.Item></Col>
      <Col span={24}><Form.Item name="summary" label="Summary / minute"><Input.TextArea autoSize={{ minRows: 2 }} placeholder="Gist of the document and any instruction minuted on it" /></Form.Item></Col>
    </Row>
  );
}

function Records() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const isAdmin = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.ADMIN : false;
  const [scope, setScope] = useState<Scope>((params.get("scope") as Scope) || "all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [fileId, setFileId] = useState<string | undefined>();
  const [deptId, setDeptId] = useState<string | undefined>();
  const qs = new URLSearchParams();
  if (scope === "IN" || scope === "OUT") qs.set("direction", scope);
  if (scope === "mine" || scope === "overdue") qs.set("scope", scope);
  if (q) qs.set("q", q);
  if (status) qs.set("status", status);
  if (fileId) qs.set("fileId", fileId);
  if (deptId) qs.set("departmentId", deptId);
  const { data, isLoading, mutate } = useApi<Resp>(`/api/records?${qs}`);
  const canRegister = !!data?.access.canRegister;
  const { data: users } = useApi<Named[]>("/api/users?active=1");
  const { data: departments } = useApi<Named[]>("/api/departments");
  const { data: files, mutate: mutateFiles } = useApi<FileRef[]>("/api/record-files");
  // undefined = follow the ?open= query (deep links from notifications); a click or close takes over
  const [openState, setOpenState] = useState<string | null | undefined>(undefined);
  const openId = openState === undefined ? params.get("open") : openState;
  const setOpenId = (id: string | null) => setOpenState(id);
  const { data: detail, mutate: mutateDetail } = useApi<Detail>(openId ? `/api/records/${openId}` : null);
  const [registering, setRegistering] = useState<{ direction: Direction; replyTo?: Rec; edit?: Detail } | null>(null);
  const [acting, setActing] = useState<{ action: string; title: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form] = Form.useForm();
  const [actForm] = Form.useForm();
  const [setForm] = Form.useForm();
  const close = () => { setOpenState(null); if (params.get("open")) router.replace("/app/records"); };
  const refresh = () => { mutate(); mutateDetail(); };
  const c = data?.counts || {};
  const withOfficers = (c.IN_ROUTED || 0) + (c.IN_IN_PROGRESS || 0);

  const startRegister = (direction: Direction, replyTo?: Rec, edit?: Detail) => {
    setRegistering({ direction, replyTo, edit });
    form.resetFields();
    if (edit) form.setFieldsValue({ ...edit, fileId: edit.file?.id, departmentId: edit.department?.id, assignedToId: edit.assignedTo?.id, dateLogged: dayjs(edit.dateLogged), letterDate: edit.letterDate ? dayjs(edit.letterDate) : null, actionDue: edit.actionDue ? dayjs(edit.actionDue) : null });
    else form.setFieldsValue({ docType: "LETTER", method: direction === "IN" ? "HAND" : "POST", priority: "MEDIUM", dateLogged: dayjs(), dispatched: true, confidential: false, replyToId: replyTo?.id, fileId: replyTo?.file?.id, party: replyTo?.party, contactName: replyTo?.contactName, contactDetails: replyTo?.contactDetails, theirRef: replyTo?.theirRef, relatedRef: replyTo?.relatedRef, subject: replyTo ? `Re: ${replyTo.subject}` : undefined, departmentId: direction === "OUT" ? me?.user.departmentId || undefined : undefined });
  };
  const saveRecord = async () => {
    const v = await form.validateFields();
    const json = { ...v, direction: registering!.direction, dateLogged: dateStr(v.dateLogged), letterDate: dateStr(v.letterDate), actionDue: dateStr(v.actionDue) };
    try {
      if (registering?.edit) { await api(`/api/records/${registering.edit.id}`, { method: "PATCH", json }); message.success("Entry updated"); }
      else { const r = await api<Rec>("/api/records", { method: "POST", json }); message.success(`Registered as ${r.referenceNo}`); setOpenId(r.id); mutateFiles(); }
      setRegistering(null); refresh();
    } catch (e) { message.error((e as Error).message); }
  };
  const act = async () => {
    const v = await actForm.validateFields();
    try {
      await api(`/api/records/${openId}`, { method: "POST", json: { action: acting!.action, ...v, actionDue: dateStr(v.actionDue), dateLogged: dateStr(v.dateLogged) } });
      setActing(null); refresh(); message.success("Recorded");
    } catch (e) { message.error((e as Error).message); }
  };
  const openAction = (action: string, title: string, initial: Record<string, unknown> = {}) => { setActing({ action, title }); actForm.resetFields(); actForm.setFieldsValue(initial); };
  const upload = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    try { await api(`/api/records/${openId}/attachments`, { method: "POST", body: fd }); message.success("Scan attached"); refresh(); } catch (e) { message.error((e as Error).message); }
    return false;
  };
  const removeScan = async (id: string) => { try { await api(`/api/record-attachments/${id}`, { method: "DELETE" }); refresh(); } catch (e) { message.error((e as Error).message); } };
  const saveSettings = async () => {
    const v = await setForm.validateFields();
    try { await api("/api/org", { method: "PATCH", json: { settings: { ...me!.org.settings, records: { ...(me!.org.settings.records || {}), ...v } } } }); setSettingsOpen(false); mutate(); message.success("Registry settings saved"); } catch (e) { message.error((e as Error).message); }
  };
  const statusOptions = (scope === "OUT" ? OUT_STATUSES : scope === "IN" ? IN_STATUSES : [...IN_STATUSES, ...OUT_STATUSES.filter((s) => s !== "FILED")]).map((s) => ({ value: s, label: RECORD_STATUS_LABELS[s] }));
  const incomingOpen = (data?.items || []).filter((r) => r.direction === "IN" && !RECORD_DONE.includes(r.status as never));
  const d = detail;
  const canAct = !!d && (canRegister || d.assignedTo?.id === me?.user.id || d.registeredBy?.id === me?.user.id);

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Correspondence register</Typography.Title>
          <div className="muted">Every external letter, email, invoice and legal paper that comes in or goes out: registry number, who it was routed to, the reply, the scans and the file it sits on.</div>
        </div>
        <Space wrap>
          <Segmented value={scope} onChange={(v) => { setScope(v as Scope); setStatus(undefined); }} options={[{ value: "all", label: "All" }, { value: "IN", label: "Incoming" }, { value: "OUT", label: "Outgoing" }, { value: "mine", label: c.mine ? `My action · ${c.mine}` : "My action" }]} />
          <Button icon={<DownloadOutlined />} onClick={() => downloadUrl(`/api/records?${qs}&format=csv`)}>CSV</Button>
          {isAdmin && <Tooltip title="Registry clerks, numbering and reply time"><Button icon={<SettingOutlined />} onClick={() => { setSettingsOpen(true); setForm.setFieldsValue({ clerkIds: me?.org.settings.records?.clerkIds || [], prefix: me?.org.settings.records?.prefix || "", replyDays: me?.org.settings.records?.replyDays ?? 7 }); }} /></Tooltip>}
          <Button icon={<SendOutlined />} onClick={() => startRegister("OUT")}>Register outgoing</Button>
          {canRegister && <Button type="primary" icon={<PlusOutlined />} onClick={() => startRegister("IN")}>Register incoming</Button>}
        </Space>
      </div>
      {canRegister && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><StatCard tone="blue" icon={<InboxOutlined />} value={c.IN_RECEIVED || 0} label="Awaiting routing" hint="Received, not yet sent to a department" onClick={() => { setScope("IN"); setStatus("RECEIVED"); }} /></Col>
          <Col xs={12} md={6}><StatCard tone="purple" icon={<UserOutlined />} value={withOfficers} label="With action officers" hint={`${c.receivedMonth || 0} received this month`} onClick={() => { setScope("IN"); setStatus("ROUTED,IN_PROGRESS"); }} /></Col>
          <Col xs={12} md={6}><StatCard tone="orange" icon={<ClockCircleOutlined />} value={c.overdue || 0} label="Replies overdue" hint="Past the action date" onClick={() => { setScope("overdue"); setStatus(undefined); }} /></Col>
          <Col xs={12} md={6}><StatCard tone="green" icon={<SendOutlined />} value={c.OUT_DRAFT || 0} label="Awaiting dispatch" hint={`${c.dispatchedMonth || 0} dispatched this month`} onClick={() => { setScope("OUT"); setStatus("DRAFT"); }} /></Col>
        </Row>
      )}
      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Search registry no, subject, sender, their ref, file" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 320 }} />
          <Select allowClear placeholder="Any status" value={status} onChange={setStatus} style={{ width: 180 }} options={statusOptions} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="Any file" value={fileId} onChange={setFileId} style={{ width: 240 }} options={(files || []).map((f) => ({ value: f.id, label: `${f.fileNo} · ${f.title}` }))} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="Any department" value={deptId} onChange={setDeptId} style={{ width: 220 }} options={(departments || []).map((x) => ({ value: x.id, label: x.name }))} />
        </Space>
        {isLoading || !data ? <Skeleton active /> : data.items.length === 0 ? <Empty description={scope === "mine" ? "Nothing is waiting on you" : "No correspondence matches"} /> : (
          <Table<Rec> rowKey="id" dataSource={data.items} size="small" pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 1000 }} onRow={(r) => ({ onClick: () => setOpenId(r.id), style: { cursor: "pointer" } })} columns={[
            { title: "Registry no", width: 190, render: (_, r) => <Space size={6}><DirectionIcon d={r.direction} /><span className="mono"><b>{r.referenceNo}</b></span>{r.confidential && <Tooltip title="Confidential"><LockOutlined /></Tooltip>}</Space> },
            { title: "Date", width: 100, render: (_, r) => formatDate(r.dateLogged) },
            { title: "From / to", width: 220, render: (_, r) => <span>{r.party}{r.theirRef ? <div className="muted" style={{ fontSize: 12 }}>Ref {r.theirRef}</div> : null}</span> },
            { title: "Subject", render: (_, r) => <span>{r.subject}<div className="muted" style={{ fontSize: 12 }}>{DOC_TYPE_LABELS[r.docType as keyof typeof DOC_TYPE_LABELS] || r.docType}{r.file ? ` · File ${r.file.fileNo}` : ""}{r.relatedRef ? ` · ${r.relatedRef}` : ""}</div></span> },
            { title: "Routed to", width: 190, render: (_, r) => r.direction === "IN" ? <span>{r.assignedTo?.name || <span className="muted">{r.department ? "Head of department" : "–"}</span>}{r.department ? <div className="muted" style={{ fontSize: 12 }}>{r.department.name}</div> : null}</span> : <span className="muted">{r.department?.name || "–"}</span> },
            { title: "Status", width: 150, render: (_, r) => <span><StatusTag status={r.status} labels={RECORD_STATUS_LABELS} /><Due r={r} /></span> },
            { title: "", width: 60, align: "right", render: (_, r) => <span className="muted">{r._count.attachments ? <><PaperClipOutlined /> {r._count.attachments}</> : null}{r._count.replies ? <Tooltip title="Replies registered"> ↩ {r._count.replies}</Tooltip> : null}</span> },
          ]} />
        )}
      </Card>

      <Drawer open={!!openId} onClose={close} size={680} title={d ? <Space><DirectionIcon d={d.direction} /><span className="mono">{d.referenceNo}</span><StatusTag status={d.status} labels={RECORD_STATUS_LABELS} /><PriorityTag priority={d.priority} compact /></Space> : "Correspondence"}
        extra={d && (canRegister || (d.registeredBy?.id === me?.user.id && d.status === "DRAFT")) && <Button onClick={() => startRegister(d.direction, undefined, d)}>Edit</Button>}>
        {!d ? <Skeleton active /> : (
          <>
            <Typography.Title level={5} style={{ marginTop: 0 }}>{d.subject}</Typography.Title>
            {d.overdue && <Alert type="error" showIcon style={{ marginBottom: 12 }} title={`Reply overdue: action was due ${formatDate(d.actionDue)}`} />}
            {d.confidential && <Alert type="warning" showIcon icon={<LockOutlined />} style={{ marginBottom: 12 }} title="Confidential: visible only to registry, administrators, the action officer and the head of the department" />}
            <Row gutter={[12, 6]} style={{ marginBottom: 12 }}>
              <Col span={12}><span className="muted">{d.direction === "IN" ? "From" : "To"}</span><div><b>{d.party}</b>{d.contactName ? <div>{d.contactName}</div> : null}{d.contactDetails ? <div className="muted" style={{ fontSize: 12 }}>{d.contactDetails}</div> : null}</div></Col>
              <Col span={6}><span className="muted">Their ref</span><div>{d.theirRef || "–"}</div></Col>
              <Col span={6}><span className="muted">Document</span><div>{DOC_TYPE_LABELS[d.docType as keyof typeof DOC_TYPE_LABELS] || d.docType}{d.pages ? ` · ${d.pages} p.` : ""}</div></Col>
              <Col span={6}><span className="muted">{d.direction === "IN" ? "Received" : d.status === "DRAFT" ? "Registered" : "Dispatched"}</span><div>{formatDate(d.dateLogged)}</div></Col>
              <Col span={6}><span className="muted">Dated</span><div>{formatDate(d.letterDate) || "–"}</div></Col>
              <Col span={6}><span className="muted">{d.direction === "IN" ? "Received by" : "Sent by"}</span><div>{METHOD_LABELS[d.method as keyof typeof METHOD_LABELS] || d.method}</div></Col>
              <Col span={6}><span className="muted">File</span><div>{d.file ? <Link href={`/app/records/files?open=${d.file.id}`}>{d.file.fileNo}</Link> : <span className="muted">not yet filed</span>}</div></Col>
              {d.direction === "IN" ? (
                <>
                  <Col span={12}><span className="muted">Routed to</span><div>{d.assignedTo?.name || (d.department ? "Head of department" : "–")}{d.department ? <div className="muted" style={{ fontSize: 12 }}>{d.department.name}</div> : null}</div></Col>
                  <Col span={12}><span className="muted">Action required</span><div>{d.actionRequired || "–"}{d.actionDue && <div className="muted" style={{ fontSize: 12 }}>by {formatDate(d.actionDue)}</div>}</div></Col>
                </>
              ) : (
                <>
                  <Col span={8}><span className="muted">Signed by</span><div>{d.signedBy || "–"}</div></Col>
                  <Col span={8}><span className="muted">Dispatched by</span><div>{d.dispatchedById || "–"}</div></Col>
                  <Col span={8}><span className="muted">Tracking no</span><div>{d.trackingNo || "–"}</div></Col>
                  {d.replyTo && <Col span={24}><span className="muted">In reply to</span><div><a onClick={() => setOpenId(d.replyTo!.id)}><span className="mono">{d.replyTo.referenceNo}</span> {d.replyTo.subject}</a></div></Col>}
                </>
              )}
              {d.enclosures && <Col span={12}><span className="muted">Enclosures</span><div>{d.enclosures}</div></Col>}
              {d.relatedRef && <Col span={12}><span className="muted">Related</span><div className="mono">{d.relatedRef}</div></Col>}
              {d.summary && <Col span={24}><span className="muted">Summary / minute</span><div style={{ whiteSpace: "pre-wrap" }}>{d.summary}</div></Col>}
              <Col span={24}><span className="muted">Registered by</span> {d.registeredBy?.name || "–"} · {formatDate(d.events[d.events.length - 1]?.createdAt || d.dateLogged, true)}</Col>
            </Row>
            {canAct && (
              <Space wrap style={{ marginBottom: 16 }}>
                {d.direction === "IN" && canRegister && !RECORD_DONE.includes(d.status as never) && <Button type={d.status === "RECEIVED" ? "primary" : "default"} onClick={() => openAction("route", d.status === "RECEIVED" ? "Route to a department / officer" : "Re-route", { departmentId: d.department?.id, assignedToId: d.assignedTo?.id, actionRequired: d.actionRequired, actionDue: d.actionDue ? dayjs(d.actionDue) : null })}>{d.status === "RECEIVED" ? "Route" : "Re-route"}</Button>}
                {d.direction === "IN" && ["RECEIVED", "ROUTED"].includes(d.status) && d.assignedTo?.id === me?.user.id && <Button type="primary" onClick={() => openAction("start", "Start working on it")}>Start action</Button>}
                {d.direction === "IN" && !RECORD_DONE.includes(d.status as never) && <Button type={d.status === "IN_PROGRESS" ? "primary" : "default"} icon={<SendOutlined />} onClick={() => startRegister("OUT", d)}>Register reply</Button>}
                {d.direction === "IN" && canRegister && !RECORD_DONE.includes(d.status as never) && <Button onClick={() => openAction("extend", "Move the action date", { actionDue: d.actionDue ? dayjs(d.actionDue) : null })}>Extend date</Button>}
                {d.direction === "OUT" && d.status === "DRAFT" && <Button type="primary" icon={<SendOutlined />} onClick={() => openAction("dispatch", "Record dispatch", { dateLogged: dayjs(), dispatchedById: d.dispatchedById, trackingNo: d.trackingNo })}>Dispatch</Button>}
                {d.direction === "OUT" && d.status === "DISPATCHED" && <Button onClick={() => openAction("acknowledge", "Recipient acknowledged receipt")}>Acknowledged</Button>}
                {canRegister && d.status !== "FILED" && !(d.direction === "OUT" && d.status === "DRAFT") && <Button icon={<FileTextOutlined />} onClick={() => openAction("file", "Place on file", { fileId: d.file?.id })}>File</Button>}
                {canRegister && RECORD_DONE.includes(d.status as never) && <Button onClick={() => openAction("reopen", "Reopen")}>Reopen</Button>}
                <Button onClick={() => openAction("note", "Add a note")}>Add note</Button>
              </Space>
            )}
            {d.replies.length > 0 && (
              <Card size="small" title="Replies" style={{ marginBottom: 16 }}>
                {d.replies.map((k) => <div key={k.id}><a onClick={() => setOpenId(k.id)}><span className="mono">{k.referenceNo}</span> {k.subject}</a> <span style={{ marginLeft: 6 }}><StatusTag status={k.status} labels={RECORD_STATUS_LABELS} /></span> <span className="muted" style={{ fontSize: 12 }}>{formatDate(k.dateLogged)}</span></div>)}
              </Card>
            )}
            <Card size="small" title={<span><PaperClipOutlined /> Scans and enclosures ({d.attachments.length})</span>} style={{ marginBottom: 16 }} extra={canAct && <Upload beforeUpload={upload} showUploadList={false} multiple><Button size="small" icon={<UploadOutlined />}>Attach scan</Button></Upload>}>
              {d.attachments.length === 0 ? <span className="muted">No scan attached yet. Attach the scanned original so the paper can go straight to the file.</span> : d.attachments.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0" }}>
                  <span><a href={`/api/record-attachments/${a.id}?inline=1`} target="_blank" rel="noreferrer">{a.fileName}</a>{a.label ? <Tag style={{ marginLeft: 8 }}>{a.label}</Tag> : null}<div className="muted" style={{ fontSize: 12 }}>{fmtSize(a.size)} · {a.uploader?.name || "–"} · {formatDate(a.createdAt, true)}</div></span>
                  <Space><Button size="small" icon={<DownloadOutlined />} onClick={() => downloadUrl(`/api/record-attachments/${a.id}`)} />{canRegister && <Popconfirm title="Remove this scan?" onConfirm={() => removeScan(a.id)}><Button size="small" danger>Remove</Button></Popconfirm>}</Space>
                </div>
              ))}
            </Card>
            <Typography.Title level={5}>History</Typography.Title>
            <Timeline items={d.events.map((e) => ({ color: ["FILED", "REPLIED", "DISPATCHED", "ACKNOWLEDGED"].includes(e.kind) ? "green" : ["ROUTED", "REASSIGNED"].includes(e.kind) ? "blue" : e.kind === "REOPENED" ? "red" : "gray", content: <span><b>{EVENT_LABELS[e.kind] || e.kind}</b>{e.toUserId ? ` to ${(users || []).find((u) => u.id === e.toUserId)?.name || "officer"}` : ""}{e.note ? ` · ${e.note}` : ""}<div className="muted" style={{ fontSize: 12 }}>{formatDate(e.createdAt, true)}{e.actor ? ` · ${e.actor.name}` : ""}</div></span> }))} />
          </>
        )}
      </Drawer>

      <Modal open={!!registering} width={860} destroyOnHidden onCancel={() => setRegistering(null)} onOk={saveRecord} okText={registering?.edit ? "Save" : "Register"}
        title={registering?.edit ? `Edit ${registering.edit.referenceNo}` : registering?.replyTo ? <span>Register reply to <span className="mono">{registering.replyTo.referenceNo}</span></span> : registering?.direction === "IN" ? "Register incoming correspondence" : "Register outgoing correspondence"}>
        {registering && <Form form={form} layout="vertical"><RecordFields direction={registering.direction} form={form} users={users || []} departments={departments || []} files={files || []} incoming={incomingOpen} editing={!!registering.edit} me={me?.user} /></Form>}
      </Modal>

      <Modal open={!!acting} title={acting?.title} onCancel={() => setActing(null)} onOk={act} okText="Record" destroyOnHidden>
        <Form form={actForm} layout="vertical">
          {acting?.action === "route" && (
            <>
              <Form.Item name="departmentId" label="Department"><Select allowClear showSearch optionFilterProp="label" options={(departments || []).map((x) => ({ value: x.id, label: x.name }))} onChange={() => actForm.setFieldValue("assignedToId", undefined)} /></Form.Item>
              <Form.Item noStyle shouldUpdate>{() => <Form.Item name="assignedToId" label="Action officer"><Select allowClear showSearch optionFilterProp="label" placeholder="Head of department if left blank" options={(users || []).filter((u) => !actForm.getFieldValue("departmentId") || u.departmentId === actForm.getFieldValue("departmentId")).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>}</Form.Item>
              <Form.Item name="actionRequired" label="Action required"><Input /></Form.Item>
              <Form.Item name="actionDue" label="Reply / action by"><DatePicker style={{ width: "100%" }} /></Form.Item>
            </>
          )}
          {acting?.action === "extend" && <Form.Item name="actionDue" label="New action date" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item>}
          {acting?.action === "dispatch" && (
            <>
              <Form.Item name="dateLogged" label="Date dispatched" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item>
              <Form.Item name="dispatchedById" label="Dispatched by (messenger / courier)"><Input /></Form.Item>
              <Form.Item name="trackingNo" label="Tracking / registered post no"><Input /></Form.Item>
            </>
          )}
          {acting?.action === "file" && <Form.Item name="fileId" label="File" rules={[{ required: true, message: "Choose the file" }]}><Select showSearch optionFilterProp="label" options={(files || []).map((f) => ({ value: f.id, label: `${f.fileNo} · ${f.title}` }))} /></Form.Item>}
          <Form.Item name="note" label={acting?.action === "note" ? "Note" : "Note (optional)"} rules={acting?.action === "note" ? [{ required: true }] : []}><Input.TextArea autoSize={{ minRows: 2 }} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={settingsOpen} title="Registry settings" onCancel={() => setSettingsOpen(false)} onOk={saveSettings} okText="Save" destroyOnHidden>
        <Form form={setForm} layout="vertical">
          <Form.Item name="clerkIds" label="Registry clerks" extra="These officers register, route and file mail for the whole council (managers and administrators always can)"><Select mode="multiple" showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>
          <Form.Item name="prefix" label="Registry number prefix" extra="Numbers look like PREFIX/IN/2026/0001; blank uses the council prefix"><Input placeholder="RLB" maxLength={12} /></Form.Item>
          <Form.Item name="replyDays" label="Standard reply time (days)" rules={[{ required: true }]}><InputNumber min={1} max={90} style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default function RecordsPage() { return <Suspense><Records /></Suspense>; }
