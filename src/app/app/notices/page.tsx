"use client";

import { App, Button, Card, Col, Drawer, Empty, Form, Input, Modal, Popconfirm, Progress, Row, Segmented, Select, Skeleton, Space, Switch, Table, Tag, Typography } from "antd";
import { CheckCircleOutlined, PlusOutlined, PushpinFilled } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, formatDate, timeAgo, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";

interface Notice { id: string; title: string; body: string; kind: string; departmentIds: string[]; roles: string[]; requiresAck: boolean; pinned: boolean; linkUrl?: string | null; publishedAt?: string | null; expiresAt?: string | null; createdAt: string; createdBy?: { name: string } | null; acknowledged: boolean; ackAt?: string | null; ackCount: number }
interface Detail extends Notice { audienceCount: number; pending: { id: string; name: string; department: string }[]; acks: { ackAt: string; user: { id: string; name: string; department?: { name: string } | null } }[] }

const KIND: Record<string, { label: string; color: string }> = { CIRCULAR: { label: "Circular", color: "blue" }, POLICY: { label: "Policy", color: "purple" }, ANNOUNCEMENT: { label: "Announcement", color: "green" }, MEMO: { label: "Memo", color: "gold" } };

function Notices() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const isAdmin = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.ADMIN : false;
  const [view, setView] = useState<"mine" | "manage">("mine");
  const { data, isLoading, mutate } = useApi<Notice[]>(view === "manage" ? "/api/notices?all=1" : "/api/notices");
  const { data: departments } = useApi<{ id: string; name: string }[]>(isAdmin ? "/api/departments" : null);
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const { data: detail, mutate: mutateDetail } = useApi<Detail>(openId ? `/api/notices/${openId}` : null);
  const [composing, setComposing] = useState<Notice | "new" | null>(null);
  const [form] = Form.useForm();
  useEffect(() => { const o = params.get("open"); if (o) setOpenId(o); }, [params]);

  const ack = async (id: string) => {
    try { await api(`/api/notices/${id}/ack`, { method: "POST" }); message.success("Acknowledged"); mutate(); mutateDetail(); } catch (e) { message.error((e as Error).message); }
  };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (composing === "new") await api("/api/notices", { method: "POST", json: v });
      else if (composing) await api(`/api/notices/${composing.id}`, { method: "PATCH", json: v });
      setComposing(null); mutate(); message.success(v.publish === false ? "Saved as draft" : "Published");
    } catch (e) { message.error((e as Error).message); }
  };
  const compose = (n: Notice | "new") => { setComposing(n); form.resetFields(); form.setFieldsValue(n === "new" ? { kind: "CIRCULAR", departmentIds: [], roles: [], requiresAck: false, pinned: false, publish: true } : { ...n, publish: !!n.publishedAt }); };

  const unacked = (data || []).filter((n) => n.requiresAck && !n.acknowledged);

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Notice board</Typography.Title>
          <div className="muted">Circulars, policies and announcements from the Directorate and sections. Items marked for acknowledgement must be confirmed as read.</div>
        </div>
        <Space wrap>
          {isAdmin && <Segmented value={view} onChange={(v) => setView(v as "mine" | "manage")} options={[{ value: "mine", label: "Board" }, { value: "manage", label: "Manage" }]} />}
          {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => compose("new")}>New notice</Button>}
        </Space>
      </div>
      {isLoading || !data ? <Skeleton active /> : view === "manage" ? (
        <Card>
          <Table<Notice> rowKey="id" dataSource={data} size="small" pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 800 }} columns={[
            { title: "Notice", render: (_, n) => <a onClick={() => setOpenId(n.id)}>{n.pinned && <PushpinFilled style={{ color: "#d97706", marginRight: 6 }} />}<b>{n.title}</b></a> },
            { title: "Kind", width: 130, render: (_, n) => <Tag color={KIND[n.kind]?.color}>{KIND[n.kind]?.label || n.kind}</Tag> },
            { title: "Audience", width: 200, render: (_, n) => <span className="muted" style={{ fontSize: 12 }}>{n.departmentIds.length ? n.departmentIds.map((id) => departments?.find((d) => d.id === id)?.name || "?").join(", ") : "Everyone"}{n.roles.length ? ` · ${n.roles.join("/").toLowerCase()}` : ""}</span> },
            { title: "Status", width: 120, render: (_, n) => n.publishedAt ? (n.expiresAt && new Date(n.expiresAt) < new Date() ? <Tag>Expired</Tag> : <Tag color="green">Published</Tag>) : <Tag color="gold">Draft</Tag> },
            { title: "Acknowledged", width: 130, render: (_, n) => n.requiresAck ? <a onClick={() => setOpenId(n.id)}>{n.ackCount} so far</a> : <span className="muted">not required</span> },
            { title: "", width: 120, render: (_, n) => <Space><a onClick={() => compose(n)}>Edit</a><Popconfirm title="Delete this notice?" onConfirm={async () => { await api(`/api/notices/${n.id}`, { method: "DELETE" }); mutate(); }}><a style={{ color: "#c53030" }}>Delete</a></Popconfirm></Space> },
          ]} />
        </Card>
      ) : data.length === 0 ? <Card><Empty description="No notices yet" /></Card> : (
        <>
          {unacked.length > 0 && <Card size="small" style={{ marginBottom: 16, borderColor: "#f59e0b", background: "#fffbeb" }}><b>{unacked.length} notice{unacked.length === 1 ? "" : "s"}</b> need{unacked.length === 1 ? "s" : ""} your acknowledgement: {unacked.map((n) => <a key={n.id} onClick={() => setOpenId(n.id)} style={{ marginLeft: 8 }}>{n.title}</a>)}</Card>}
          <Row gutter={[16, 16]}>
            {data.map((n) => (
            <Col xs={24} md={12} xl={8} key={n.id}>
              <Card hoverable onClick={() => setOpenId(n.id)} size="small" style={{ height: "100%", borderTop: `3px solid ${n.kind === "POLICY" ? "#7c3aed" : n.kind === "ANNOUNCEMENT" ? "#22a06b" : n.kind === "MEMO" ? "#d97706" : "var(--brand-color)"}` }}>
                <Space size={6} wrap style={{ marginBottom: 6 }}>
                  <Tag color={KIND[n.kind]?.color}>{KIND[n.kind]?.label}</Tag>
                  {n.pinned && <Tag icon={<PushpinFilled />} color="orange">Pinned</Tag>}
                  {n.requiresAck && (n.acknowledged ? <Tag icon={<CheckCircleOutlined />} color="green">Acknowledged</Tag> : <Tag color="red">Acknowledge</Tag>)}
                </Space>
                <Typography.Text strong style={{ display: "block", fontSize: 15 }}>{n.title}</Typography.Text>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ marginBottom: 6, whiteSpace: "pre-wrap" }}>{n.body}</Typography.Paragraph>
                <div className="muted" style={{ fontSize: 12 }}>{n.createdBy?.name || "Administration"} · {timeAgo(n.publishedAt || n.createdAt)}{n.expiresAt ? ` · until ${formatDate(n.expiresAt)}` : ""}</div>
              </Card>
            </Col>
            ))}
          </Row>
        </>
      )}

      <Drawer open={!!openId} onClose={() => setOpenId(null)} size={640} title={detail ? <Space><Tag color={KIND[detail.kind]?.color}>{KIND[detail.kind]?.label}</Tag>{detail.title}</Space> : "Notice"}
        extra={detail?.requiresAck && !detail.acknowledged && detail.publishedAt ? <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => ack(detail.id)}>I have read and understood</Button> : detail?.acknowledged ? <Tag color="green" icon={<CheckCircleOutlined />}>Acknowledged {formatDate(detail.ackAt, true)}</Tag> : null}>
        {!detail ? <Skeleton active /> : (
          <>
            <div className="muted" style={{ marginBottom: 12 }}>{detail.createdBy?.name || "Administration"} · {detail.publishedAt ? `published ${formatDate(detail.publishedAt, true)}` : "draft"}{detail.expiresAt ? ` · valid until ${formatDate(detail.expiresAt)}` : ""}</div>
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap", fontSize: 15 }}>{detail.body}</Typography.Paragraph>
            {detail.linkUrl && <Typography.Paragraph><a href={detail.linkUrl} target="_blank" rel="noopener noreferrer">Open attached document / link ↗</a></Typography.Paragraph>}
            {isAdmin && detail.requiresAck && (
              <Card size="small" title={`Acknowledgements · ${detail.acks.length} of ${detail.audienceCount}`} style={{ marginTop: 16 }}>
                <Progress percent={detail.audienceCount ? Math.round((detail.acks.length / detail.audienceCount) * 100) : 0} size="small" />
                {detail.pending.length > 0 && <div style={{ marginTop: 8 }}><b>Still to acknowledge:</b> <span className="muted">{detail.pending.map((p) => p.name).join(", ")}</span></div>}
                {detail.acks.length > 0 && <div style={{ marginTop: 8 }}><b>Acknowledged:</b> <span className="muted">{detail.acks.map((a) => `${a.user.name} (${formatDate(a.ackAt)})`).join(", ")}</span></div>}
              </Card>
            )}
          </>
        )}
      </Drawer>

      <Modal open={!!composing} title={composing === "new" ? "New notice" : "Edit notice"} onCancel={() => setComposing(null)} onOk={save} okText={composing === "new" ? "Publish" : "Save"} width={680} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, min: 3 }]}><Input placeholder="e.g. Circular 4/2026: Revised T&S rates" /></Form.Item>
          <Space size="large" wrap>
            <Form.Item name="kind" label="Kind"><Select style={{ width: 170 }} options={Object.entries(KIND).map(([k, v]) => ({ value: k, label: v.label }))} /></Form.Item>
            <Form.Item name="requiresAck" label="Requires acknowledgement" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="pinned" label="Pin to top" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="publish" label="Published" valuePropName="checked"><Switch /></Form.Item>
          </Space>
          <Form.Item name="body" label="Notice" rules={[{ required: true }]}><Input.TextArea autoSize={{ minRows: 6, maxRows: 18 }} placeholder="Plain text. Paragraphs and numbered points are kept as typed." /></Form.Item>
          <Form.Item name="departmentIds" label="Sections (leave empty for everyone)"><Select mode="multiple" allowClear showSearch optionFilterProp="label" options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Form.Item>
          <Form.Item name="roles" label="Roles (leave empty for all roles)"><Select mode="multiple" allowClear options={[{ value: "MEMBER", label: "Officers" }, { value: "MANAGER", label: "Heads of section" }, { value: "ADMIN", label: "Administrators" }, { value: "OWNER", label: "Director General" }]} /></Form.Item>
          <Form.Item name="linkUrl" label="Link to the full document (optional)"><Input placeholder="https://" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default function NoticesPage() { return <Suspense><Notices /></Suspense>; }
