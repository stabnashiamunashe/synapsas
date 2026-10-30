"use client";

import { App, Avatar, Button, Card, Col, Descriptions, Divider, Empty, Form, Input, Modal, Popconfirm, Row, Select, Skeleton, Space, Tag, Typography, Upload } from "antd";
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FileOutlined, PaperClipOutlined, PrinterOutlined, RollbackOutlined, SendOutlined, UploadOutlined, UserSwitchOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatDate, formatMoney, timeAgo, useApi, useMe } from "@/lib/client";
import { PriorityTag, StatusTag } from "@/components/StatusTag";
import { ProjectPicker } from "@/components/ProjectPicker";
import { DataView } from "@/components/DataView";
import { RequestTimeline, type ApprovalRow } from "@/components/RequestTimeline";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";
import { LeaveBalance } from "@/components/LeaveBalance";
import { AdvanceBalance } from "@/components/AdvanceBalance";
import { DynamicFields } from "@/components/DynamicForm";
import type { FieldDef, LevelDef, TemplateSettings, TemplateSnapshot } from "@/lib/types";

interface Detail {
  id: string; referenceNo: string; title: string; status: string; priority: string; currentLevel: number; data: Record<string, unknown>;
  costAmount: number | null; project: { id: string; code: string; name: string } | null;
  activeLevels: number[]; templateSnapshot: TemplateSnapshot | null; dueAt?: string | null; submittedAt?: string | null; completedAt?: string | null; createdAt: string;
  requester: { id: string; name: string; email: string; avatarUrl?: string | null; department?: { name: string } | null; manager?: { name: string } | null };
  template: { id: string; name: string; fields: FieldDef[]; levels: LevelDef[]; settings: TemplateSettings };
  approvals: ApprovalRow[];
  comments: { id: string; body: string; isSystem: boolean; createdAt: string; user: { id: string; name: string; avatarUrl?: string | null } }[];
  attachments: { id: string; fileName: string; size: number; mimeType: string; createdAt: string; uploadedBy: { name: string } }[];
  permissions: { canAct: boolean; canEdit: boolean; canSubmit: boolean; canCancel: boolean; isAdmin: boolean };
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { data: me } = useMe();
  const { data: r, mutate, isLoading } = useApi<Detail>(`/api/requests/${id}`);
  const [action, setAction] = useState<null | "APPROVE" | "REJECT" | "RETURN" | "DELEGATE">(null);
  const [comment, setComment] = useState("");
  const [delegateTo, setDelegateTo] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [form] = Form.useForm();
  const { data: users } = useApi<{ id: string; name: string }[]>(action === "DELEGATE" ? "/api/users" : null);
  const currency = me?.org.settings.currency || "USD";

  if (isLoading || !r) return <Skeleton active />;
  const snap = r.templateSnapshot && r.templateSnapshot.fields ? r.templateSnapshot : { fields: r.template.fields, levels: r.template.levels, settings: r.template.settings, name: r.template.name };
  const isLeave = ((r.templateSnapshot as { category?: string } | null)?.category || (r.template as { category?: string }).category) === "LEAVE";
  const fields = snap.fields;
  const levels = snap.levels;
  const currentLevelDef = levels.find((l) => l.order === r.currentLevel);

  const doAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      await api(`/api/requests/${id}/action`, { method: "POST", json: { action, comment: comment || undefined, delegateToId: delegateTo } });
      message.success({ APPROVE: "Request approved", REJECT: "Request rejected", RETURN: "Returned to requester", DELEGATE: "Delegated" }[action]);
      setAction(null); setComment(""); setDelegateTo(undefined);
      mutate();
    } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true);
    try {
      if (editing) {
        const values = await form.validateFields();
        const { title, priority, projectId, ...data } = values;
        await api(`/api/requests/${id}`, { method: "PATCH", json: { title, priority, projectId: projectId || null, data } });
        setEditing(false);
      }
      await api(`/api/requests/${id}/submit`, { method: "POST" });
      message.success("Submitted for approval");
      mutate();
    } catch (e) {
      const err = e as { message?: string; details?: { message: string }[]; errorFields?: unknown };
      if (!err.errorFields) message.error(err.details?.length ? err.details.map((d) => d.message).join("; ") : err.message || "Failed");
    } finally { setBusy(false); }
  };
  const saveEdit = async () => {
    try {
      const values = form.getFieldsValue(true);
      const { title, priority, projectId, ...data } = values;
      await api(`/api/requests/${id}`, { method: "PATCH", json: { title, priority, projectId: projectId || null, data } });
      setEditing(false); message.success("Saved"); mutate();
    } catch (e) { message.error((e as Error).message); }
  };
  const cancel = async () => {
    try {
      const res = await api<{ deleted?: boolean }>(`/api/requests/${id}`, { method: "DELETE" });
      if (res.deleted) { message.success("Draft deleted"); router.push("/app/requests"); } else { message.success("Request cancelled"); mutate(); }
    } catch (e) { message.error((e as Error).message); }
  };
  const addComment = async () => {
    if (!newComment.trim()) return;
    try { await api(`/api/requests/${id}/comments`, { method: "POST", json: { body: newComment } }); setNewComment(""); mutate(); } catch (e) { message.error((e as Error).message); }
  };
  const upload = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    try { await api(`/api/requests/${id}/attachments`, { method: "POST", body: fd }); message.success("Uploaded"); mutate(); } catch (e) { message.error((e as Error).message); }
    return false;
  };
  const canAttach = !["APPROVED", "REJECTED", "CANCELLED"].includes(r.status) && (r.permissions.canEdit || r.permissions.canAct || r.permissions.isAdmin) && snap.settings.allowAttachments !== false;

  return (
    <div>
      <div className="page-header no-print">
        <div className="page-head-left">
          <Link href="/app/requests"><Button icon={<ArrowLeftOutlined />} type="text" /></Link>
          <div>
            <div className="title-row">
              <Typography.Title level={3} className="page-title"><span className="mono muted" style={{ fontWeight: 400, marginRight: 8 }}>{r.referenceNo}</span>{r.title}</Typography.Title>
              <StatusTag status={r.status} /><PriorityTag priority={r.priority} />
            </div>
            <div className="muted">
              {snap.name} · raised by {r.requester.name} {timeAgo(r.createdAt)}{r.dueAt ? ` · due ${formatDate(r.dueAt)}` : ""}
              {r.project && <> · <Link href={`/app/projects/${r.project.id}`} style={{ color: "var(--brand-color)", fontWeight: 500 }}>{r.project.code} · {r.project.name}</Link></>}
              {r.costAmount != null && <> · <span className="mono" style={{ color: "var(--text)" }}>{formatMoney(r.costAmount, currency)}</span></>}
            </div>
          </div>
        </div>
        <Space wrap>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
          {r.permissions.canEdit && !editing && <Button icon={<EditOutlined />} onClick={() => { form.setFieldsValue({ title: r.title, priority: r.priority, projectId: r.project?.id, ...r.data }); setEditing(true); }}>Edit</Button>}
          {editing && <Button onClick={saveEdit}>Save changes</Button>}
          {r.permissions.canSubmit && <Button type="primary" icon={<SendOutlined />} loading={busy} onClick={submit}>{r.status === "RETURNED" ? "Resubmit" : "Submit for approval"}</Button>}
          {r.permissions.canCancel && (
            <Popconfirm title={r.status === "DRAFT" ? "Delete this draft?" : "Cancel this request?"} onConfirm={cancel}>
              <Button danger icon={<DeleteOutlined />}>{r.status === "DRAFT" ? "Delete" : "Cancel"}</Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      {r.permissions.canAct && (
        <Card className="no-print" style={{ marginBottom: 16, borderColor: "var(--brand-color)", borderLeftWidth: 4 }} styles={{ body: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 } }}>
          <div>
            <Typography.Text strong>Your decision is needed</Typography.Text>
            <div className="muted">Level {r.currentLevel}: {currentLevelDef?.name}{currentLevelDef?.description ? ` — ${currentLevelDef.description}` : ""}</div>
          </div>
          <Space wrap>
            <Button className="btn-tint btn-green" icon={<CheckOutlined />} onClick={() => setAction("APPROVE")}>Approve</Button>
            {currentLevelDef?.allowReturn !== false && <Button className="btn-tint btn-amber" icon={<RollbackOutlined />} onClick={() => setAction("RETURN")}>Return for changes</Button>}
            {currentLevelDef?.allowDelegate && <Button className="btn-tint btn-blue" icon={<UserSwitchOutlined />} onClick={() => setAction("DELEGATE")}>Delegate</Button>}
            <Button className="btn-tint btn-red" icon={<CloseOutlined />} onClick={() => setAction("REJECT")}>Reject</Button>
          </Space>
        </Card>
      )}

      {levels.length > 0 && (
        <Card title="Where this request is in the flow" size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 8 } }}>
          <WorkflowDiagram levels={levels} activeLevels={r.activeLevels || []} approvals={r.approvals} currentLevel={r.currentLevel} status={r.status} height={200} compact />
          {isLeave && <div style={{ marginTop: 12 }}><LeaveBalance userId={r.requester.id} requestedDays={Number((r.data as Record<string, unknown>).daysRequired) || undefined} compact /></div>}
          {snap.settings.advances && <div style={{ marginTop: 12 }}><AdvanceBalance userId={r.requester.id} compact /></div>}
        </Card>
      )}

      <Row gutter={16}>
        <Col xs={24} lg={15}>
          <Card title="Details" style={{ marginBottom: 16 }}>
            {editing ? (
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col xs={24} md={12}><Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item></Col>
                  <Col xs={24} md={7}><Form.Item name="projectId" label="Project" rules={snap.settings.requireProject ? [{ required: true, message: "Choose a project" }] : []}><ProjectPicker /></Form.Item></Col>
                  <Col xs={24} md={5}><Form.Item name="priority" label="Priority"><Select options={["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => ({ value: p, label: p }))} /></Form.Item></Col>
                </Row>
                <DynamicFields fields={r.template.fields} currency={currency} />
              </Form>
            ) : (
              <DataView fields={fields} data={r.data} currency={currency} />
            )}
          </Card>

          <Card title={<span><PaperClipOutlined /> Attachments ({r.attachments.length})</span>} style={{ marginBottom: 16 }} extra={canAttach && <Upload beforeUpload={upload} showUploadList={false} multiple><Button size="small" icon={<UploadOutlined />}>Upload</Button></Upload>}>
            {r.attachments.length === 0 ? <Typography.Text type="secondary">No files attached.</Typography.Text> : (
              <Space orientation="vertical" style={{ width: "100%" }} size={6}>
                {r.attachments.map((a) => (
                  <Card key={a.id} size="small" styles={{ body: { padding: "8px 12px" } }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FileOutlined style={{ fontSize: 18, color: "var(--brand-color)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener"><Typography.Text strong ellipsis>{a.fileName}</Typography.Text></a>
                        <div className="muted" style={{ fontSize: 12 }}>{(a.size / 1024).toFixed(0)} KB · {a.uploadedBy.name} · {formatDate(a.createdAt, true)}</div>
                      </div>
                      <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener">Open</a>
                      {canAttach && <Popconfirm title="Remove file?" onConfirm={async () => { await api(`/api/attachments/${a.id}`, { method: "DELETE" }); mutate(); }}><a style={{ color: "#c53030" }}>Remove</a></Popconfirm>}
                    </div>
                  </Card>
                ))}
              </Space>
            )}
          </Card>

          <Card title={`Discussion (${r.comments.length})`} className="no-print">
            {r.comments.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No comments yet" /> : (
              <Space orientation="vertical" style={{ width: "100%" }} size={6}>
                {r.comments.map((c) => (
                  <Card key={c.id} size="small" style={c.isSystem ? { background: "#f8f9fb" } : undefined} styles={{ body: { padding: "8px 12px" } }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <Avatar size="small" src={c.user.avatarUrl || undefined}>{c.user.name.slice(0, 1)}</Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Space size={6}><Typography.Text strong>{c.user.name}</Typography.Text>{c.isSystem && <Tag style={{ marginInlineEnd: 0 }}>system</Tag>}<span className="muted" style={{ fontSize: 12 }}>{formatDate(c.createdAt, true)}</span></Space>
                        <div style={{ whiteSpace: "pre-wrap", color: "rgba(0,0,0,.78)", marginTop: 2 }}>{c.body}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </Space>
            )}
            <Divider style={{ margin: "12px 0" }} />
            <Space.Compact style={{ width: "100%" }}>
              <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment…" onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); addComment(); } }} />
              <Button type="primary" onClick={addComment}>Post</Button>
            </Space.Compact>
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title="Approval flow" style={{ marginBottom: 16 }}>
            {levels.length === 0 ? <Typography.Text type="secondary">No approval levels configured; auto-approved on submit.</Typography.Text> : (
              <RequestTimeline levels={levels} activeLevels={r.activeLevels || []} approvals={r.approvals} currentLevel={r.currentLevel} status={r.status} />
            )}
          </Card>
          <Card title="Requester" size="small">
            <Descriptions column={1} size="small" items={[
              { key: "n", label: "Name", children: r.requester.name },
              { key: "e", label: "Email", children: r.requester.email },
              { key: "d", label: "Department", children: r.requester.department?.name || "–" },
              { key: "m", label: "Manager", children: r.requester.manager?.name || "–" },
              { key: "pj", label: "Project", children: r.project ? <Link href={`/app/projects/${r.project.id}`}>{r.project.code} · {r.project.name}</Link> : "–" },
              { key: "ct", label: "Cost", children: r.costAmount != null ? <span className="mono">{formatMoney(r.costAmount, currency)}</span> : "–" },
              { key: "s", label: "Submitted", children: r.submittedAt ? formatDate(r.submittedAt, true) : "–" },
              { key: "c", label: "Completed", children: r.completedAt ? formatDate(r.completedAt, true) : "–" },
            ]} />
          </Card>
        </Col>
      </Row>

      <Modal open={!!action} title={action === "APPROVE" ? "Approve request" : action === "REJECT" ? "Reject request" : action === "RETURN" ? "Return for changes" : "Delegate approval"} onCancel={() => setAction(null)} onOk={doAction} confirmLoading={busy} okText={action === "APPROVE" ? "Approve" : action === "REJECT" ? "Reject" : action === "RETURN" ? "Return" : "Delegate"} okButtonProps={{ danger: action === "REJECT" }}>
        {action === "DELEGATE" && (
          <Select showSearch optionFilterProp="label" placeholder="Delegate to" style={{ width: "100%", marginBottom: 12 }} value={delegateTo} onChange={setDelegateTo}
            options={(users || []).filter((u) => u.id !== me?.user.id).map((u) => ({ value: u.id, label: u.name }))} />
        )}
        <Input.TextArea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={action === "APPROVE" ? (currentLevelDef?.requireComment ? "Comment (required)" : "Optional comment") : "Explain your decision (required)"} />
      </Modal>
    </div>
  );
}
