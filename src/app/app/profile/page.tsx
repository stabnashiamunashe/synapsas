"use client";

import { Alert, App, Button, Card, Col, Descriptions, Form, Input, Modal, QRCode, Row, Select, Skeleton, Space, Switch, Tabs, Tag, Typography } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, formatDate, useMe } from "@/lib/client";
import { PASSWORD_POLICY } from "@/lib/security";

function Profile() {
  const { message } = App.useApp();
  const { data: me, mutate } = useMe();
  const params = useSearchParams();
  const [pwForm] = Form.useForm();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [enableCode, setEnableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableForm] = Form.useForm();
  const [busy, setBusy] = useState(false);
  if (!me) return <Skeleton active />;

  const saveProfile = async (v: { name: string; jobTitle?: string; avatarUrl?: string }) => {
    try { await api(`/api/users/${me.user.id}`, { method: "PATCH", json: v }); message.success("Profile updated"); mutate(); } catch (e) { message.error((e as Error).message); }
  };
  const savePrefs = async (prefs: Record<string, unknown>) => {
    try { await api(`/api/users/${me.user.id}`, { method: "PATCH", json: { prefs } }); mutate(); } catch (e) { message.error((e as Error).message); }
  };
  const changePassword = async (v: { currentPassword: string; newPassword: string }) => {
    setBusy(true);
    try { await api("/api/auth/password/change", { method: "POST", json: v }); message.success("Password changed. Other sessions were signed out."); pwForm.resetFields(); mutate(); }
    catch (e) { const err = e as { message: string; details?: { message: string }[] }; message.error(err.details?.length ? err.details.map((d) => d.message).join(". ") : err.message); }
    finally { setBusy(false); }
  };
  const start2fa = async () => {
    try { setSetup(await api<{ secret: string; uri: string }>("/api/auth/2fa/setup", { method: "POST" })); } catch (e) { message.error((e as Error).message); }
  };
  const enable2fa = async () => {
    setBusy(true);
    try { const r = await api<{ backupCodes: string[] }>("/api/auth/2fa/enable", { method: "POST", json: { code: enableCode } }); setBackupCodes(r.backupCodes); setSetup(null); setEnableCode(""); mutate(); }
    catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };
  const disable2fa = async () => {
    const v = await disableForm.validateFields();
    setBusy(true);
    try { await api("/api/auth/2fa/disable", { method: "POST", json: v }); message.success("Two-factor authentication disabled"); setDisableOpen(false); disableForm.resetFields(); mutate(); }
    catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };
  const revokeSessions = async () => {
    try { await api("/api/auth/sessions/revoke", { method: "POST" }); message.success("All other sessions were signed out"); } catch (e) { message.error((e as Error).message); }
  };
  const prefs = me.user.prefs || {};

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3} className="page-title">My account</Typography.Title>
      </div>
      <Tabs defaultActiveKey={params.get("tab") || "profile"} items={[
        {
          key: "profile", label: "Profile", children: (
            <Row gutter={16}>
              <Col xs={24} md={14}>
                <Card title="Profile">
                  <Form layout="vertical" onFinish={saveProfile} initialValues={{ name: me.user.name, jobTitle: me.user.jobTitle || "", avatarUrl: me.user.avatarUrl || "" }}>
                    <Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
                    <Form.Item name="jobTitle" label="Job title"><Input /></Form.Item>
                    <Form.Item name="avatarUrl" label="Avatar URL"><Input placeholder="https://…" /></Form.Item>
                    <Button type="primary" htmlType="submit">Save</Button>
                  </Form>
                </Card>
              </Col>
              <Col xs={24} md={10}>
                <Card title="Membership">
                  <Descriptions column={1} size="small" items={[
                    { key: "e", label: "Email", children: me.user.email },
                    { key: "r", label: "Role", children: me.user.role },
                    { key: "d", label: "Department", children: me.user.department?.name || "–" },
                    { key: "m", label: "Manager", children: me.user.manager?.name || "–" },
                    { key: "o", label: "Workspace", children: `${me.org.name} (${me.org.slug})` },
                    { key: "p", label: "Plan", children: me.org.plan },
                  ]} />
                </Card>
              </Col>
            </Row>
          ),
        },
        {
          key: "security", label: <span><SafetyCertificateOutlined /> Security</span>, children: (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card title="Two-factor authentication" extra={me.user.twoFactorEnabled ? <Tag color="green">Enabled</Tag> : <Tag>Off</Tag>}>
                  {me.security.mustSetup2fa && <Alert type="warning" showIcon title="Your workspace requires 2FA for administrators." style={{ marginBottom: 12 }} />}
                  {!me.user.twoFactorEnabled && !setup && (
                    <>
                      <Typography.Paragraph type="secondary">Protect your account with a time-based code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy).</Typography.Paragraph>
                      <Button type="primary" onClick={start2fa}>Set up two-factor</Button>
                    </>
                  )}
                  {setup && (
                    <Space orientation="vertical" style={{ width: "100%" }}>
                      <Typography.Text>1. Scan this QR code with your authenticator app.</Typography.Text>
                      <QRCode value={setup.uri} size={168} />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Or enter the key manually: <span className="mono">{setup.secret}</span></Typography.Text>
                      <Typography.Text>2. Enter the 6-digit code it shows.</Typography.Text>
                      <Space.Compact style={{ width: "100%" }}>
                        <Input value={enableCode} onChange={(e) => setEnableCode(e.target.value)} placeholder="123456" className="mono" inputMode="numeric" maxLength={8} />
                        <Button type="primary" onClick={enable2fa} loading={busy} disabled={enableCode.length < 6}>Verify & enable</Button>
                      </Space.Compact>
                      <Button type="link" onClick={() => setSetup(null)} style={{ padding: 0 }}>Cancel</Button>
                    </Space>
                  )}
                  {me.user.twoFactorEnabled && (
                    <Space orientation="vertical">
                      <Typography.Text type="secondary">Backup codes remaining: <b>{me.user.backupCodesLeft}</b>. Each can be used once if you lose your device.</Typography.Text>
                      <Space>
                        <Button onClick={start2fa}>Re-enrol device</Button>
                        <Button danger onClick={() => setDisableOpen(true)}>Disable 2FA</Button>
                      </Space>
                    </Space>
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Change password">
                  <Typography.Paragraph type="secondary">{PASSWORD_POLICY.description} Changing it signs out your other sessions.</Typography.Paragraph>
                  <Form form={pwForm} layout="vertical" onFinish={changePassword}>
                    <Form.Item name="currentPassword" label="Current password" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
                    <Form.Item name="newPassword" label="New password" rules={[{ required: true, min: PASSWORD_POLICY.minLength }]}><Input.Password autoComplete="new-password" /></Form.Item>
                    <Form.Item name="confirm" label="Confirm" dependencies={["newPassword"]} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, v) => (v === getFieldValue("newPassword") ? Promise.resolve() : Promise.reject(new Error("Passwords do not match"))) })]}><Input.Password autoComplete="new-password" /></Form.Item>
                    <Button type="primary" htmlType="submit" loading={busy}>Update password</Button>
                  </Form>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Sessions & sign-in activity">
                  <Descriptions column={1} size="small" items={[
                    { key: "l", label: "Last sign-in", children: me.user.lastLoginAt ? `${formatDate(me.user.lastLoginAt, true)} from ${me.user.lastLoginIp || "unknown"}` : "–" },
                    { key: "p", label: "Password changed", children: me.user.passwordChangedAt ? formatDate(me.user.passwordChangedAt, true) : "never" },
                    { key: "s", label: "Session length", children: `${me.org.settings.sessionHours || 8} hours` },
                  ]} />
                  <Button style={{ marginTop: 12 }} onClick={revokeSessions}>Sign out of all other devices</Button>
                </Card>
              </Col>
            </Row>
          ),
        },
        {
          key: "notifications", label: "Notifications", children: (
            <Card title="Notification preferences" style={{ maxWidth: 640 }}>
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Approvals waiting on me</span><Switch checked={prefs.approvalsInApp !== false} onChange={(v) => savePrefs({ approvalsInApp: v })} /></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Comments on my requests</span><Switch checked={prefs.commentsInApp !== false} onChange={(v) => savePrefs({ commentsInApp: v })} /></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Status changes (approved, rejected, returned)</span><Switch checked={prefs.statusInApp !== false} onChange={(v) => savePrefs({ statusInApp: v })} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Email digest</span><Select style={{ width: 160 }} value={prefs.emailDigest || "none"} onChange={(v) => savePrefs({ emailDigest: v })} options={[{ value: "none", label: "Off" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} /></div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Email delivery activates once an email provider is configured for the workspace.</Typography.Text>
              </Space>
            </Card>
          ),
        },
      ]} />

      <Modal open={!!backupCodes} title="Save your backup codes" onOk={() => setBackupCodes(null)} onCancel={() => setBackupCodes(null)} cancelButtonProps={{ style: { display: "none" } }} okText="I have saved them">
        <Alert type="warning" showIcon title="These codes are shown once. Store them somewhere safe." style={{ marginBottom: 12 }} />
        <Row gutter={[8, 8]}>{backupCodes?.map((c) => <Col span={12} key={c}><Typography.Text code copyable className="mono">{c}</Typography.Text></Col>)}</Row>
      </Modal>
      <Modal open={disableOpen} title="Disable two-factor authentication" onOk={disable2fa} onCancel={() => setDisableOpen(false)} confirmLoading={busy} okButtonProps={{ danger: true }} okText="Disable">
        <Form form={disableForm} layout="vertical">
          <Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
          <Form.Item name="code" label="Current code or backup code" rules={[{ required: true }]}><Input className="mono" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense><Profile /></Suspense>;
}
