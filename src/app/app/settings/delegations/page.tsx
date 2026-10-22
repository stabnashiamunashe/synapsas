"use client";

import { App, Button, Card, DatePicker, Form, Input, Popconfirm, Select, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { api, formatDate, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";

interface D { id: string; fromUserId: string; toUserId: string; reason?: string | null; startsAt: string; endsAt: string; isActive: boolean; from: { name: string }; to: { name: string } }

export default function DelegationsPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const { data, mutate } = useApi<D[]>("/api/delegations");
  const { data: users } = useApi<{ id: string; name: string }[]>("/api/users");
  const [form] = Form.useForm();
  const isAdmin = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.ADMIN : false;

  const submit = async (v: { toUserId: string; fromUserId?: string; reason?: string; range: [dayjs.Dayjs, dayjs.Dayjs] }) => {
    try {
      await api("/api/delegations", { method: "POST", json: { toUserId: v.toUserId, fromUserId: v.fromUserId, reason: v.reason, startsAt: v.range[0].startOf("day").toISOString(), endsAt: v.range[1].endOf("day").toISOString() } });
      message.success("Delegation created"); form.resetFields(); mutate();
    } catch (e) { message.error((e as Error).message); }
  };
  const now = Date.now();

  return (
    <div>
      <Card title="Out of office / delegation" style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary">While a delegation is active, any approval that would be routed to you goes to your delegate instead.</Typography.Paragraph>
        <Form form={form} layout="inline" onFinish={submit} style={{ gap: 8 }}>
          {isAdmin && <Form.Item name="fromUserId" label="For"><Select allowClear showSearch optionFilterProp="label" placeholder="Me" style={{ width: 180 }} options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>}
          <Form.Item name="toUserId" label="Delegate to" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" style={{ width: 200 }} options={(users || []).filter((u) => u.id !== me?.user.id).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>
          <Form.Item name="range" label="Period" rules={[{ required: true }]}><DatePicker.RangePicker /></Form.Item>
          <Form.Item name="reason"><Input placeholder="Reason (optional)" style={{ width: 200 }} /></Form.Item>
          <Button type="primary" htmlType="submit">Add</Button>
        </Form>
      </Card>
      <Table<D> rowKey="id" dataSource={data || []} pagination={false}
        columns={[
          { title: "From", render: (_, d) => d.from.name },
          { title: "To", render: (_, d) => d.to.name },
          { title: "Period", render: (_, d) => `${formatDate(d.startsAt)} → ${formatDate(d.endsAt)}` },
          { title: "Reason", dataIndex: "reason", render: (v) => v || <span className="muted">–</span> },
          { title: "Status", render: (_, d) => !d.isActive ? <Tag>ended</Tag> : new Date(d.startsAt).getTime() > now ? <Tag color="blue">scheduled</Tag> : new Date(d.endsAt).getTime() < now ? <Tag>expired</Tag> : <Tag color="green">active</Tag> },
          { title: "", width: 80, render: (_, d) => d.isActive && (d.fromUserId === me?.user.id || isAdmin) ? <Popconfirm title="End delegation?" onConfirm={async () => { await api(`/api/delegations/${d.id}`, { method: "DELETE" }); mutate(); }}><a style={{ color: "#ff4d4f" }}>End</a></Popconfirm> : null },
        ]} />
    </div>
  );
}
