"use client";

import { Alert, App, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Progress, Row, Select, Skeleton, Space, Table, Typography } from "antd";
import { ArrowLeftOutlined, DownloadOutlined, EditOutlined, FolderOpenOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api, downloadUrl, formatDate, formatMoney, useApi, useMe } from "@/lib/client";
import { StatCard } from "@/components/StatCard";
import { PriorityTag, StatusTag } from "@/components/StatusTag";
import { ROLE_RANK } from "@/lib/roles";
import type { ProjectRow } from "../page";

interface Detail extends ProjectRow {
  byTemplate: { templateId: string; name: string; color?: string | null; count: number; approved: number; pending: number; other: number }[];
  byMonth: { month: string; approved: number; pending: number; count: number }[];
  requests: { id: string; referenceNo: string; title: string; status: string; priority: string; costAmount: number | null; createdAt: string; completedAt?: string | null; requester: { name: string }; template: { name: string; color?: string | null } }[];
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { data: me } = useMe();
  const { data: p, mutate, isLoading } = useApi<Detail>(`/api/projects/${id}`);
  const { data: users } = useApi<{ id: string; name: string }[]>("/api/users");
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const canManage = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const isAdmin = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.ADMIN : false;
  if (isLoading || !p) return <Skeleton active />;
  const s = p.summary;
  const cur = p.currency;
  const maxMonth = Math.max(1, ...p.byMonth.map((m) => m.approved + m.pending));

  const save = async () => {
    const v = await form.validateFields();
    try {
      await api(`/api/projects/${p.id}`, { method: "PATCH", json: { ...v, startsAt: v.dates?.[0] ? v.dates[0].toISOString() : null, endsAt: v.dates?.[1] ? v.dates[1].toISOString() : null, dates: undefined } });
      message.success("Project updated"); setEditing(false); mutate();
    } catch (e) { message.error((e as Error).message); }
  };
  const archive = async () => {
    try { const r = await api<{ deleted?: boolean }>(`/api/projects/${p.id}`, { method: "DELETE" }); message.success(r.deleted ? "Project deleted" : "Project archived"); router.push("/app/projects"); } catch (e) { message.error((e as Error).message); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-head-left">
          <Link href="/app/projects"><Button icon={<ArrowLeftOutlined />} type="text" /></Link>
          <div>
            <div className="title-row">
              <Typography.Title level={3} className="page-title"><span className="mono muted" style={{ fontWeight: 400, marginRight: 8 }}>{p.code}</span>{p.name}</Typography.Title>
              <StatusTag status={p.status} />
            </div>
            <div className="muted">{p.owner ? `Owner: ${p.owner.name} · ` : ""}{p.startsAt || p.endsAt ? `${formatDate(p.startsAt)} → ${formatDate(p.endsAt)} · ` : ""}{s.requests} request{s.requests === 1 ? "" : "s"}</div>
          </div>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => downloadUrl(`/api/projects/${p.id}/export`)}>Export CSV</Button>
          {["ACTIVE", "ON_HOLD"].includes(p.status) && <Link href={`/app/requests/new?project=${p.id}`}><Button className="btn-tint btn-green" icon={<PlusOutlined />}>New request on this project</Button></Link>}
          {canManage && <Button icon={<EditOutlined />} onClick={() => { form.setFieldsValue({ ...p, dates: p.startsAt || p.endsAt ? [p.startsAt ? dayjs(p.startsAt) : null, p.endsAt ? dayjs(p.endsAt) : null] : undefined }); setEditing(true); }}>Edit</Button>}
          {isAdmin && p.status !== "ARCHIVED" && <Popconfirm title={s.requests ? "Archive this project? Its requests keep their history." : "Delete this empty project?"} onConfirm={archive}><Button danger>{s.requests ? "Archive" : "Delete"}</Button></Popconfirm>}
        </Space>
      </div>

      {s.budget != null && s.remaining != null && s.remaining < 0 && <Alert type="error" showIcon style={{ marginBottom: 16 }} title={`Approved spend exceeds the budget by ${formatMoney(-s.remaining, cur)}.`} />}
      {s.budget != null && s.remainingAfterPending != null && s.remainingAfterPending < 0 && (s.remaining ?? 0) >= 0 && <Alert type="warning" showIcon style={{ marginBottom: 16 }} title={`Pending requests would take this project ${formatMoney(-s.remainingAfterPending, cur)} over budget if all are approved.`} />}

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><StatCard tone="grey" icon={<FolderOpenOutlined />} value={s.budget == null ? "–" : formatMoney(s.budget, cur)} label="Budget" hint={s.utilisation != null ? <Progress percent={Math.min(100, Math.round(s.utilisation * 100))} size="small" showInfo={false} strokeColor={s.utilisation > 1 ? "#e5484d" : s.utilisation > 0.85 ? "#f59e0b" : undefined} /> : <span className="muted">Set a budget to track utilisation</span>} /></Col>
        <Col xs={12} md={6}><StatCard tone="green" icon={<span>✓</span>} value={formatMoney(s.approved, cur)} label="Approved spend" hint={<span className="muted">{s.byStatus.APPROVED?.count || 0} approved request{(s.byStatus.APPROVED?.count || 0) === 1 ? "" : "s"}{s.utilisation != null ? ` · ${Math.round(s.utilisation * 100)}% of budget` : ""}</span>} /></Col>
        <Col xs={12} md={6}><StatCard tone="orange" icon={<span>…</span>} value={formatMoney(s.pending, cur)} label="Awaiting approval" hint={<span className="muted">{s.byStatus.PENDING?.count || 0} in the approval chain</span>} /></Col>
        <Col xs={12} md={6}><StatCard tone={s.remaining != null && s.remaining < 0 ? "orange" : "blue"} icon={<span>=</span>} value={s.remaining == null ? "–" : formatMoney(s.remaining, cur)} label="Remaining (approved)" hint={s.remainingAfterPending != null ? <span className="muted">{formatMoney(s.remainingAfterPending, cur)} if pending is approved</span> : <span className="muted">{formatMoney(s.draft, cur)} in drafts</span>} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Spend by month" extra={<span className="muted">approved · pending</span>}>
            {p.byMonth.length === 0 ? <Typography.Text type="secondary">No requests yet.</Typography.Text> : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 190, overflowX: "auto" }}>
                {p.byMonth.map((m) => (
                  <div key={m.month} style={{ flex: "0 1 72px", textAlign: "center", minWidth: 44, maxWidth: 72 }}>
                    <div title={`${formatMoney(m.approved, cur)} approved, ${formatMoney(m.pending, cur)} pending`} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 140, gap: 2 }}>
                      <div style={{ background: "#f59e0b", height: `${(m.pending / maxMonth) * 100}%`, borderRadius: "4px 4px 0 0", opacity: 0.7 }} />
                      <div style={{ background: "var(--brand-color)", height: `${(m.approved / maxMonth) * 100}%`, borderRadius: m.pending ? 0 : "4px 4px 0 0", minHeight: m.approved ? 2 : 0 }} />
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{m.month.slice(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Spend by workflow" style={{ height: "100%" }}>
            <Table size="small" pagination={false} rowKey="templateId" dataSource={p.byTemplate} locale={{ emptyText: "Nothing yet" }}
              columns={[
                { title: "Workflow", dataIndex: "name", render: (v, t) => <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: t.color || "var(--brand-color)", marginRight: 6 }} />{v}</span> },
                { title: "#", dataIndex: "count", width: 50 },
                { title: "Approved", align: "right", render: (_, t) => <span className="mono">{formatMoney(t.approved, cur)}</span> },
                { title: "Pending", align: "right", render: (_, t) => <span className="mono muted">{formatMoney(t.pending, cur)}</span> },
              ]} />
          </Card>
        </Col>
      </Row>

      <Card title={`Requests (${p.requests.length})`} style={{ marginTop: 16 }}>
        <Table rowKey="id" size="small" dataSource={p.requests} pagination={{ pageSize: 20, hideOnSinglePage: true }} onRow={(r) => ({ onClick: () => router.push(`/app/requests/${r.id}`), className: "clickable-row" })} locale={{ emptyText: "No requests linked to this project yet" }}
          columns={[
            { title: "Reference", dataIndex: "referenceNo", width: 150, render: (v) => <span className="mono">{v}</span> },
            { title: "Title", dataIndex: "title", ellipsis: true },
            { title: "Workflow", width: 170, render: (_, r) => r.template.name },
            { title: "Requester", width: 150, render: (_, r) => r.requester.name },
            { title: "Priority", width: 100, render: (_, r) => <PriorityTag priority={r.priority} /> },
            { title: "Status", width: 140, render: (_, r) => <StatusTag status={r.status} /> },
            { title: "Cost", width: 140, align: "right", render: (_, r) => r.costAmount == null ? <span className="muted">–</span> : <span className="mono">{formatMoney(r.costAmount, cur)}</span> },
            { title: "Completed", width: 110, render: (_, r) => r.completedAt ? formatDate(r.completedAt) : <span className="muted">–</span> },
          ]} />
      </Card>

      {p.description && <Card title="About" style={{ marginTop: 16 }}><Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{p.description}</Typography.Paragraph></Card>}

      <Modal open={editing} onCancel={() => setEditing(false)} onOk={save} title="Edit project" okText="Save" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={8}><Form.Item name="code" label="Code" rules={[{ required: true, pattern: /^[A-Z0-9][A-Z0-9-]*$/, message: "Uppercase letters, numbers, dashes" }]} normalize={(v: string) => (v || "").toUpperCase()}><Input /></Form.Item></Col>
            <Col span={16}><Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="budgetAmount" label="Budget"><InputNumber style={{ width: "100%" }} min={0} precision={2} prefix={cur} /></Form.Item></Col>
            <Col span={12}><Form.Item name="currency" label="Currency"><Select options={["USD", "ZWG", "ZAR", "EUR", "GBP", "KES", "NGN", "BWP", "ZMW", "MZN"].map((c) => ({ value: c, label: c }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="ownerUserId" label="Project owner"><Select allowClear showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="Status"><Select options={[{ value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On hold" }, { value: "CLOSED", label: "Closed (no new requests)" }, { value: "ARCHIVED", label: "Archived" }]} /></Form.Item></Col>
            <Col span={24}><Form.Item name="dates" label="Period"><DatePicker.RangePicker style={{ width: "100%" }} allowEmpty={[true, true]} /></Form.Item></Col>
          </Row>
          <Descriptions size="small" column={1} items={[{ key: "n", label: "Note", children: "Closing or archiving stops new requests being attached; existing spend stays counted." }]} />
        </Form>
      </Modal>
    </div>
  );
}
