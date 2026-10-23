"use client";

import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Switch, Typography } from "antd";
import { api, useMe } from "@/lib/client";
import { CASE_STATUSES, CASE_STATUS_LABELS, DEFAULT_CASE_SETTINGS } from "@/lib/caseTypes";

export default function ServiceDeskSettingsPage() {
  const { message } = App.useApp();
  const { data: me, mutate } = useMe();
  if (!me) return null;
  const save = async (v: Record<string, unknown>) => {
    try {
      await api("/api/org", { method: "PATCH", json: { settings: { ...me.org.settings, cases: { ...(me.org.settings.cases || {}), ...v } } } });
      mutate(); message.success("Saved");
    } catch (e) { message.error((e as Error).message); }
  };
  return (
    <Card title="Service desk & public portal">
      <Form layout="vertical" onFinish={save} initialValues={{ ...DEFAULT_CASE_SETTINGS, ...(me.org.settings.cases || {}) }}>
        <Typography.Title level={5}>Routing</Typography.Title>
        <Row gutter={12}>
          <Col xs={12} md={6}><Form.Item name="prefix" label="Reference prefix" rules={[{ pattern: /^[A-Z0-9]{1,6}$/, message: "Capitals and digits, up to 6" }]}><Input placeholder="ZS" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="slaWarningHours" label="Warn before SLA due (hours)"><InputNumber min={1} max={168} style={{ width: "100%" }} /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="autoAssign" label="Auto-assign to least-busy officer" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="requireTriage" label="Section head triages first" valuePropName="checked" extra="New cases wait in Triaged until assigned by hand."><Switch /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="requireTransitionReason" label="Reason required on status change" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="defaultView" label="Default view"><Select options={[{ value: "board", label: "Board" }, { value: "table", label: "Table" }]} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="boardColumns" label="Board columns"><Select mode="multiple" options={CASE_STATUSES.map((s) => ({ value: s, label: CASE_STATUS_LABELS[s] }))} /></Form.Item></Col>
        </Row>
        <Typography.Title level={5}>Public portal (/report and /track)</Typography.Title>
        <Row gutter={12}>
          <Col xs={24} md={6}><Form.Item name="publicPortal" label="Accept reports from the public" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={24} md={9}><Form.Item name="contactEmail" label="Contact email" rules={[{ type: "email" }]}><Input /></Form.Item></Col>
          <Col xs={24} md={9}><Form.Item name="contactPhone" label="Contact phone"><Input /></Form.Item></Col>
          <Col xs={24}><Form.Item name="portalHeading" label="Heading"><Input placeholder="Report an issue or request a service from ZimStat" /></Form.Item></Col>
          <Col xs={24}><Form.Item name="portalSubtext" label="Introduction"><Input.TextArea autoSize={{ minRows: 2 }} /></Form.Item></Col>
          <Col xs={24} md={18}><Form.Item name="announcement" label="Announcement banner"><Input placeholder="e.g. The data request desk is closed on 18 April." /></Form.Item></Col>
          <Col xs={24} md={6}><Form.Item name="announcementActive" label="Show announcement" valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>
        <Button type="primary" htmlType="submit">Save</Button>
      </Form>
    </Card>
  );
}
