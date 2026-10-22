"use client";

import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Skeleton, Space, Switch, Typography } from "antd";
import { useState } from "react";
import { api, useMe } from "@/lib/client";
import { PASSWORD_POLICY } from "@/lib/security";

export default function OrganizationSettingsPage() {
  const { message } = App.useApp();
  const { data: me, mutate } = useMe();
  const [sweeping, setSweeping] = useState(false);
  if (!me) return <Skeleton active />;

  const save = async (values: Record<string, unknown>) => {
    const { name, ...settings } = values;
    try { await api("/api/org", { method: "PATCH", json: { name, settings } }); message.success("Saved"); mutate(); } catch (e) { message.error((e as Error).message); }
  };
  const sweep = async () => {
    setSweeping(true);
    try { const r = await api<{ checked: number; escalated: number }>("/api/org/escalate", { method: "POST" }); message.success(`Checked ${r.checked} overdue step(s), escalated ${r.escalated}.`); } catch (e) { message.error((e as Error).message); } finally { setSweeping(false); }
  };

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      <Card title="Organisation">
        <Form layout="vertical" onFinish={save} initialValues={{ name: me.org.name, currency: "USD", requireCommentOnReject: true, allowSelfApproval: false, emailNotifications: true, sessionHours: 8, lockoutThreshold: 5, require2faForAdmins: false, ...me.org.settings }}>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="name" label="Organisation name" rules={[{ required: true, min: 2 }]}><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="currency" label="Currency"><Select options={["USD", "EUR", "GBP", "ZAR", "ZWG", "KES", "NGN", "INR", "AUD", "CAD"].map((c) => ({ value: c, label: c }))} showSearch /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="timezone" label="Timezone"><Input placeholder="Africa/Harare" /></Form.Item></Col>
            <Col span={24}>
              <Space size="large" wrap>
                <Form.Item name="requireCommentOnReject" valuePropName="checked" label="Require a comment when rejecting"><Switch /></Form.Item>
                <Form.Item name="allowSelfApproval" valuePropName="checked" label="Allow approvers to approve their own requests"><Switch /></Form.Item>
                <Form.Item name="emailNotifications" valuePropName="checked" label="Email notifications (when a provider is configured)"><Switch /></Form.Item>
              </Space>
            </Col>
          </Row>

          <Typography.Title level={5} style={{ marginTop: 8 }}>Security policy</Typography.Title>
          <Typography.Paragraph type="secondary">Password rule (always enforced): {PASSWORD_POLICY.description}</Typography.Paragraph>
          <Row gutter={16}>
            <Col xs={12} md={6}><Form.Item name="sessionHours" label="Session length (hours)" extra="Users are signed out after this long."><InputNumber min={1} max={168} style={{ width: "100%" }} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="lockoutThreshold" label="Lock account after failed sign-ins" extra="Locked for 15 minutes; admins can unlock."><InputNumber min={3} max={20} style={{ width: "100%" }} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="require2faForAdmins" valuePropName="checked" label="Require two-factor authentication for owners and admins" extra="Admins without 2FA are prompted to enrol at sign-in."><Switch /></Form.Item></Col>
          </Row>
          <Button type="primary" htmlType="submit">Save</Button>
        </Form>
      </Card>
      <Card title="SLA escalation">
        <Typography.Paragraph type="secondary">
          Overdue approvals are escalated by a scheduled job hitting <span className="mono">POST /api/cron/escalate</span> with the <span className="mono">CRON_SECRET</span> bearer token.
          You can also run a sweep for this workspace now.
        </Typography.Paragraph>
        <Button onClick={sweep} loading={sweeping}>Run escalation sweep now</Button>
      </Card>
      <Card title="Workspace">
        <Typography.Paragraph>Slug: <span className="mono">{me.org.slug}</span> · Tenant login URL: <span className="mono">/login?org={me.org.slug}</span></Typography.Paragraph>
      </Card>
    </Space>
  );
}
