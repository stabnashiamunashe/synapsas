"use client";

import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { api, formatDate, useApi, useMe } from "@/lib/client";

interface Key { id: string; name: string; prefix: string; createdAt: string; lastUsedAt?: string | null }
interface Hook { id: string; url: string; events: string[]; secretHint: string; isActive: boolean; lastStatus?: number | null; lastFiredAt?: string | null }
const EVENTS = ["request.submitted", "request.approved", "request.rejected", "request.returned", "request.cancelled", "request.level_advanced", "request.escalated"];

export default function ApiSettingsPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const { data: keys, mutate: mutateKeys } = useApi<Key[]>("/api/api-keys");
  const { data: hooks, mutate: mutateHooks } = useApi<Hook[]>("/api/webhooks");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [hookForm] = Form.useForm();
  const [hookOpen, setHookOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<{ url: string; secret: string } | null>(null);

  const createKey = async () => {
    try { const k = await api<{ key: string }>("/api/api-keys", { method: "POST", json: { name: keyName || "Integration" } }); setNewKey(k.key); setKeyName(""); mutateKeys(); } catch (e) { message.error((e as Error).message); }
  };
  const createHook = async () => {
    const v = await hookForm.validateFields();
    try { const h = await api<{ url: string; secret: string }>("/api/webhooks", { method: "POST", json: v }); setNewSecret({ url: h.url, secret: h.secret }); setHookOpen(false); hookForm.resetFields(); mutateHooks(); } catch (e) { message.error((e as Error).message); }
  };

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      {newKey && <Alert type="success" showIcon closable onClose={() => setNewKey(null)} title="Copy your new API key now. It will not be shown again." description={<Typography.Text code copyable>{newKey}</Typography.Text>} />}
      <Card title="API keys" extra={<Space><Input placeholder="Key name" value={keyName} onChange={(e) => setKeyName(e.target.value)} style={{ width: 180 }} /><Button type="primary" icon={<PlusOutlined />} onClick={createKey} disabled={!me?.org.limits.apiAccess}>Create key</Button></Space>}>
        <Typography.Paragraph type="secondary">
          Use <span className="mono">Authorization: Bearer &lt;key&gt;</span> against any <span className="mono">/api/*</span> endpoint, e.g. <span className="mono">GET /api/requests</span>, <span className="mono">POST /api/requests</span> (with <span className="mono">templateId</span>, <span className="mono">data</span>, <span className="mono">submit: true</span>), <span className="mono">GET /api/templates</span>. Keys act with admin rights for this workspace.
          {!me?.org.limits.apiAccess && " API access requires the Starter plan or higher."}
        </Typography.Paragraph>
        <Table<Key> rowKey="id" dataSource={keys || []} pagination={false} size="small"
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Prefix", dataIndex: "prefix", render: (p) => <span className="mono">{p}_…</span> },
            { title: "Created", dataIndex: "createdAt", render: (d) => formatDate(d) },
            { title: "Last used", dataIndex: "lastUsedAt", render: (d) => d ? formatDate(d, true) : <span className="muted">never</span> },
            { title: "", width: 80, render: (_, k) => <Popconfirm title="Revoke key?" onConfirm={async () => { await api(`/api/api-keys/${k.id}`, { method: "DELETE" }); mutateKeys(); }}><a style={{ color: "#ff4d4f" }}>Revoke</a></Popconfirm> },
          ]} />
      </Card>
      {newSecret && <Alert type="success" showIcon closable onClose={() => setNewSecret(null)} title={`Signing secret for ${newSecret.url}. Copy it now; it will not be shown again.`} description={<Typography.Text code copyable>{newSecret.secret}</Typography.Text>} />}
      <Card title="Webhooks" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setHookOpen(true)} disabled={!me?.org.limits.webhooks}>Add webhook</Button>}>
        <Typography.Paragraph type="secondary">
          Each delivery is a JSON POST with headers <span className="mono">x-webhook-event</span>, <span className="mono">x-webhook-timestamp</span> and <span className="mono">x-webhook-signature</span> (<span className="mono">t=&lt;ts&gt;,v1=HMAC-SHA256(secret, ts + "." + body)</span>). Reject deliveries whose timestamp is older than 5 minutes. Endpoints must be public https:// URLs.
          {!me?.org.limits.webhooks && " Webhooks require the Business plan or higher."}
        </Typography.Paragraph>
        <Table<Hook> rowKey="id" dataSource={hooks || []} pagination={false} size="small"
          columns={[
            { title: "URL", dataIndex: "url", ellipsis: true },
            { title: "Events", dataIndex: "events", render: (ev: string[]) => ev.length ? ev.map((e) => <Tag key={e}>{e}</Tag>) : <Tag>all</Tag> },
            { title: "Secret", dataIndex: "secretHint", render: (s, h) => <Space><span className="mono">{s}</span><Popconfirm title="Rotate secret? Deliveries signed with the old secret will fail." onConfirm={async () => { const r = await api<{ secret: string }>(`/api/webhooks/${h.id}`, { method: "POST" }); setNewSecret({ url: h.url, secret: r.secret }); mutateHooks(); }}><a>rotate</a></Popconfirm></Space> },
            { title: "Last", render: (_, h) => h.lastFiredAt ? <span>{h.lastStatus === 0 ? <Tag color="red">error</Tag> : <Tag color={h.lastStatus && h.lastStatus < 300 ? "green" : "orange"}>{h.lastStatus}</Tag>}{formatDate(h.lastFiredAt, true)}</span> : <span className="muted">never</span> },
            { title: "Active", render: (_, h) => <Switch size="small" checked={h.isActive} onChange={async (v) => { await api(`/api/webhooks/${h.id}`, { method: "PATCH", json: { isActive: v } }); mutateHooks(); }} /> },
            { title: "", width: 80, render: (_, h) => <Popconfirm title="Delete webhook?" onConfirm={async () => { await api(`/api/webhooks/${h.id}`, { method: "DELETE" }); mutateHooks(); }}><a style={{ color: "#ff4d4f" }}>Delete</a></Popconfirm> },
          ]} />
      </Card>
      <Modal open={hookOpen} onCancel={() => setHookOpen(false)} onOk={createHook} title="Add webhook">
        <Form form={hookForm} layout="vertical" initialValues={{ events: [] }}>
          <Form.Item name="url" label="Endpoint URL" rules={[{ required: true, type: "url" }]}><Input placeholder="https://example.com/hooks/approvals" /></Form.Item>
          <Form.Item name="events" label="Events (empty = all)"><Select mode="multiple" options={EVENTS.map((e) => ({ value: e, label: e }))} /></Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
