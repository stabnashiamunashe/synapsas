"use client";

import { Alert, App, Avatar, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import { CopyOutlined, DeleteOutlined, LockOutlined, MailOutlined, PlusOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useState } from "react";
import { api, formatDate, useApi, useMe } from "@/lib/client";
import { PASSWORD_POLICY } from "@/lib/security";

interface U {
  id: string; name: string; email: string; role: string; jobTitle?: string | null; isActive: boolean; departmentId?: string | null; managerId?: string | null;
  department?: { name: string } | null; manager?: { name: string } | null; lastLoginAt?: string | null; lastLoginIp?: string | null;
  twoFactorEnabled: boolean; forcePasswordChange: boolean; lockedUntil?: string | null;
}
interface Inv { id: string; email: string; role: string; expiresAt: string; createdAt: string }

const ROLE_COLORS: Record<string, string> = { OWNER: "gold", ADMIN: "purple", MANAGER: "blue", MEMBER: "default" };

export default function UsersPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const { data: users, mutate, isLoading } = useApi<U[]>("/api/users?all=1");
  const { data: invites, mutate: mutateInv } = useApi<Inv[]>("/api/invitations");
  const { data: departments } = useApi<{ id: string; name: string }[]>("/api/departments");
  const [editing, setEditing] = useState<U | null | "new" | "invite">(null);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);
  const [inviteLink, setInviteLink] = useState<{ email: string; link: string; emailed: boolean } | null>(null);
  const [form] = Form.useForm();
  const limits = me?.org.limits;
  const activeCount = users?.filter((u) => u.isActive).length || 0;

  const open = (u: U | "new" | "invite") => {
    setEditing(u);
    form.resetFields();
    if (u !== "new" && u !== "invite") form.setFieldsValue({ ...u, password: undefined });
    else form.setFieldsValue({ role: "MEMBER" });
  };
  const submit = async () => {
    const values = await form.validateFields();
    try {
      if (editing === "invite") {
        const inv = await api<Inv & { link: string; emailed: boolean }>("/api/users/invite", { method: "POST", json: values });
        setInviteLink({ email: inv.email, link: inv.link, emailed: inv.emailed });
        mutateInv();
      } else if (editing === "new") {
        const created = await api<U & { temporaryPassword?: string; emailed?: boolean }>("/api/users", { method: "POST", json: values });
        if (created.temporaryPassword) setTempPassword({ email: created.email, password: created.temporaryPassword });
        message.success(created.emailed ? "User created. Sign-in details were emailed." : "User created");
      } else if (editing) {
        await api(`/api/users/${editing.id}`, { method: "PATCH", json: values });
        message.success(values.password ? "Saved. The user must change the temporary password at next sign-in." : "Saved");
      }
      setEditing(null);
      mutate();
    } catch (e) {
      const err = e as { message: string; details?: { message: string }[] };
      message.error(err.details?.length ? err.details.map((d) => d.message).join(". ") : err.message);
    }
  };
  const deactivate = async (u: U) => { try { await api(`/api/users/${u.id}`, { method: "DELETE" }); message.success("Deactivated and signed out"); mutate(); } catch (e) { message.error((e as Error).message); } };
  const reactivate = async (u: U) => { try { await api(`/api/users/${u.id}`, { method: "PATCH", json: { isActive: true } }); mutate(); } catch (e) { message.error((e as Error).message); } };
  const unlock = async (u: U) => { try { await api(`/api/users/${u.id}`, { method: "POST" }); message.success("Account unlocked"); mutate(); } catch (e) { message.error((e as Error).message); } };
  const isLocked = (u: U) => !!u.lockedUntil && new Date(u.lockedUntil) > new Date();

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">People</Typography.Title>
          <Typography.Text type="secondary">{activeCount} active {limits && limits.users !== -1 ? `of ${limits.users} on your plan` : ""}. Managers and department heads drive approval routing.</Typography.Text>
        </div>
        <Space>
          <Button icon={<MailOutlined />} onClick={() => open("invite")}>Invite by email</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>Add user</Button>
        </Space>
      </div>
      <Tabs items={[
        {
          key: "users", label: "Members", children: (
            <Table<U> rowKey="id" loading={isLoading} dataSource={users || []} pagination={false}
              columns={[
                { title: "Name", render: (_, u) => <Space><Avatar size="small">{u.name.slice(0, 1)}</Avatar><div><div>{u.name}{!u.isActive && <Tag style={{ marginLeft: 6 }}>inactive</Tag>}{isLocked(u) && <Tag color="red" style={{ marginLeft: 6 }} icon={<LockOutlined />}>locked</Tag>}{u.forcePasswordChange && u.isActive && <Tooltip title="Must change temporary password at next sign-in"><Tag color="orange" style={{ marginLeft: 6 }}>temp password</Tag></Tooltip>}</div><div className="muted" style={{ fontSize: 12 }}>{u.email}</div></div></Space> },
                { title: "Role", dataIndex: "role", width: 110, render: (r) => <Tag color={ROLE_COLORS[r]}>{r}</Tag> },
                { title: "2FA", width: 70, align: "center", render: (_, u) => u.twoFactorEnabled ? <Tooltip title="Two-factor enabled"><SafetyCertificateOutlined style={{ color: "#2f855a" }} /></Tooltip> : <span className="muted">–</span> },
                { title: "Title", dataIndex: "jobTitle", width: 150, render: (v) => v || <span className="muted">–</span> },
                { title: "Department", width: 140, render: (_, u) => u.department?.name || <span className="muted">–</span> },
                { title: "Manager", width: 140, render: (_, u) => u.manager?.name || <span className="muted">–</span> },
                { title: "Last sign-in", width: 150, render: (_, u) => u.lastLoginAt ? <span>{formatDate(u.lastLoginAt)}<div className="muted mono" style={{ fontSize: 11 }}>{u.lastLoginIp || ""}</div></span> : <span className="muted">never</span> },
                { title: "", width: 190, render: (_, u) => <Space size="small" wrap>
                  <a onClick={() => open(u)}>Edit</a>
                  {isLocked(u) && <a onClick={() => unlock(u)}>Unlock</a>}
                  {u.isActive ? (u.id !== me?.user.id && u.role !== "OWNER" && <Popconfirm title="Deactivate this user? Their sessions end immediately." onConfirm={() => deactivate(u)}><a style={{ color: "#c53030" }}>Deactivate</a></Popconfirm>) : <a onClick={() => reactivate(u)}>Reactivate</a>}
                </Space> },
              ]} />
          ),
        },
        {
          key: "invites", label: `Pending invitations (${invites?.length || 0})`, children: (
            <Table<Inv> rowKey="id" dataSource={invites || []} pagination={false}
              columns={[
                { title: "Email", dataIndex: "email" },
                { title: "Role", dataIndex: "role", width: 110, render: (r) => <Tag color={ROLE_COLORS[r]}>{r}</Tag> },
                { title: "Expires", dataIndex: "expiresAt", width: 130, render: (d) => formatDate(d) },
                { title: "Sent", dataIndex: "createdAt", width: 130, render: (d) => formatDate(d) },
                { title: "", width: 150, render: (_, i) => <Space><Button size="small" icon={<MailOutlined />} onClick={async () => { const r = await api<{ link: string; emailed: boolean }>(`/api/invitations/${i.id}`, { method: "POST" }); setInviteLink({ email: i.email, link: r.link, emailed: r.emailed }); mutateInv(); }}>Resend</Button><Popconfirm title="Revoke invitation?" onConfirm={async () => { await api(`/api/invitations/${i.id}`, { method: "DELETE" }); mutateInv(); }}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm></Space> },
              ]} />
          ),
        },
      ]} />

      <Modal open={!!editing} onCancel={() => setEditing(null)} onOk={submit} title={editing === "invite" ? "Invite someone" : editing === "new" ? "Add user" : "Edit user"} okText={editing === "invite" ? "Create invitation" : "Save"} destroyOnHidden>
        <Form form={form} layout="vertical">
          {editing !== "invite" && <Form.Item name="name" label="Full name" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>}
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input disabled={editing !== "new" && editing !== "invite" && me?.user.role !== "OWNER"} /></Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={["OWNER", "ADMIN", "MANAGER", "MEMBER"].filter((r) => r !== "OWNER" || me?.user.role === "OWNER").map((r) => ({ value: r, label: r }))} />
          </Form.Item>
          {editing !== "invite" && <Form.Item name="jobTitle" label="Job title"><Input /></Form.Item>}
          <Form.Item name="departmentId" label="Department"><Select allowClear options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Form.Item>
          {editing !== "invite" && (
            <Form.Item name="managerId" label="Line manager (used by 'Requester's manager' levels)">
              <Select allowClear showSearch optionFilterProp="label" options={(users || []).filter((u) => u.isActive && (editing === "new" || u.id !== (editing as U).id)).map((u) => ({ value: u.id, label: u.name }))} />
            </Form.Item>
          )}
          {editing !== "invite" && editing !== null && (editing === "new" || (editing as U).id !== me?.user.id) && (
            <Form.Item name="password" label={editing === "new" ? "Temporary password (leave blank to generate one)" : "Reset password (temporary, leave blank to keep)"} extra={PASSWORD_POLICY.description} rules={[{ min: PASSWORD_POLICY.minLength, message: `At least ${PASSWORD_POLICY.minLength} characters` }]}><Input.Password autoComplete="new-password" /></Form.Item>
          )}
        </Form>
      </Modal>

      <Modal open={!!inviteLink} title="Invitation link" onOk={() => setInviteLink(null)} onCancel={() => setInviteLink(null)} cancelButtonProps={{ style: { display: "none" } }} okText="Done">
        <Alert type={inviteLink?.emailed ? "success" : "warning"} showIcon style={{ marginBottom: 12 }}
          title={inviteLink?.emailed ? `An invitation email was sent to ${inviteLink?.email}.` : "Email is not configured: copy this link and send it to the person yourself."}
          description="The link works once and expires in 7 days. It is shown here only now; use Resend to issue a new one." />
        <Space><Typography.Text className="mono" ellipsis style={{ maxWidth: 380 }}>{inviteLink?.link}</Typography.Text><Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(inviteLink?.link || ""); message.success("Copied"); }} /></Space>
      </Modal>

      <Modal open={!!tempPassword} title="Temporary password" onOk={() => setTempPassword(null)} onCancel={() => setTempPassword(null)} cancelButtonProps={{ style: { display: "none" } }} okText="Done">
        <Alert type="warning" showIcon title="Shown once. Share it securely; the user must change it at first sign-in." style={{ marginBottom: 12 }} />
        <Typography.Paragraph><b>{tempPassword?.email}</b></Typography.Paragraph>
        <Typography.Text code copyable className="mono" style={{ fontSize: 16 }}>{tempPassword?.password}</Typography.Text>
      </Modal>
    </div>
  );
}
