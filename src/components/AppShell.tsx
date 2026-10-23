"use client";

import { Alert, App, Avatar, Button, Drawer, Dropdown, Form, Grid, Input, Layout, Menu, Modal, Space, Typography, theme } from "antd";
import {
  ApartmentOutlined, AuditOutlined, BarChartOutlined, DashboardOutlined, FileTextOutlined, InboxOutlined, LogoutOutlined,
  MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, PlusOutlined, SafetyCertificateOutlined, SearchOutlined, SettingOutlined,
  TeamOutlined, UserOutlined, BranchesOutlined, ClockCircleOutlined, CalendarOutlined, FolderOpenOutlined, CustomerServiceOutlined, TagsOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandProvider, DEFAULT_BRANDING, tint } from "./Providers";
import { BrandMark } from "./BrandMark";
import { NotificationTray } from "./NotificationTray";
import { api, useMe } from "@/lib/client";
import type { BrandingSettings, SessionUser } from "@/lib/types";
import { ROLE_RANK } from "@/lib/roles";
import { PASSWORD_POLICY } from "@/lib/security";

const { Header, Sider, Content } = Layout;

export function AppShell({ branding, orgName, session, children }: {
  branding: BrandingSettings; orgName: string; session: SessionUser; children: React.ReactNode;
}) {
  return (
    <BrandProvider branding={branding}>
      <Shell branding={branding} orgName={orgName} session={session}>{children}</Shell>
    </BrandProvider>
  );
}

function Shell({ branding, orgName, session, children }: {
  branding: BrandingSettings; orgName: string; session: SessionUser; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.lg === false; // < 992px
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<{ focus: () => void } | null>(null);
  const { data: me, mutate } = useMe();
  const { token } = theme.useToken();
  const [pwForm] = Form.useForm();
  const [changing, setChanging] = useState(false);
  const b = { ...DEFAULT_BRANDING, ...branding };
  const dark = b.sidebarTheme === "dark";
  const role = me?.user.role || session.role;
  const isManager = ROLE_RANK[role] >= ROLE_RANK.MANAGER;
  const isAdmin = ROLE_RANK[role] >= ROLE_RANK.ADMIN;

  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  // Date is client-only to avoid server/client locale mismatches during hydration.
  const [today, setToday] = useState("");
  useEffect(() => { setToday(new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })); }, []);
  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const groups: { label?: string; items: { key: string; icon: React.ReactNode; label: string; show?: boolean }[] }[] = [
    {
      items: [
        { key: "/app", icon: <DashboardOutlined />, label: "Home" },
        { key: "/app/inbox", icon: <InboxOutlined />, label: `Inbox${me?.pendingApprovals ? ` (${me.pendingApprovals})` : ""}` },
        { key: "/app/requests", icon: <FileTextOutlined />, label: "Requests" },
        { key: "/app/reports", icon: <BarChartOutlined />, label: "Reports", show: isManager },
        { key: "/app/notifications", icon: <ClockCircleOutlined />, label: "Activity" },
      ],
    },
    {
      label: "Service desk",
      items: [
        { key: "/app/cases", icon: <CustomerServiceOutlined />, label: "Cases" },
        { key: "/app/cases/new", icon: <PlusOutlined />, label: "Log a case" },
        { key: "/app/cases/categories", icon: <TagsOutlined />, label: "Categories & SLAs", show: isAdmin },
      ],
    },
    {
      label: "Workflows",
      items: [
        { key: "/app/projects", icon: <FolderOpenOutlined />, label: "Projects & surveys" },
        { key: "/app/templates", icon: <BranchesOutlined />, label: "Workflow designs", show: isAdmin },
        { key: "/app/requests/new", icon: <PlusOutlined />, label: "New request" },
        { key: "/app/settings/delegations", icon: <CalendarOutlined />, label: "Out of office" },
      ],
    },
    {
      label: "Organisation",
      items: [
        { key: "/app/users", icon: <TeamOutlined />, label: "People", show: isAdmin },
        { key: "/app/departments", icon: <ApartmentOutlined />, label: "Sections & divisions", show: isAdmin },
        { key: "/app/audit", icon: <AuditOutlined />, label: "Audit log", show: isAdmin },
        { key: "/app/settings", icon: <SettingOutlined />, label: "Settings", show: isAdmin },
      ],
    },
  ];
  const allKeys = groups.flatMap((g) => g.items.filter((i) => i.show !== false).map((i) => i.key));
  const selected = allKeys.filter((k) => pathname === k || (k !== "/app" && pathname.startsWith(k))).sort((a, b2) => b2.length - a.length)[0] || "/app";

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };
  const changePassword = async () => {
    const v = await pwForm.validateFields();
    setChanging(true);
    try {
      await api("/api/auth/password/change", { method: "POST", json: { currentPassword: v.currentPassword, newPassword: v.newPassword } });
      message.success("Password updated");
      pwForm.resetFields();
      mutate();
    } catch (e) {
      const err = e as { message: string; details?: { message: string }[] };
      message.error(err.details?.length ? err.details.map((d) => d.message).join(". ") : err.message);
    } finally { setChanging(false); }
  };
  const goSearch = () => { if (search.trim()) router.push(`/app/requests?q=${encodeURIComponent(search.trim())}`); };

  const mustChangePassword = !!me?.security?.mustChangePassword;
  const mustSetup2fa = !!me?.security?.mustSetup2fa && !mustChangePassword;
  const showLabels = isMobile || !collapsed;

  const nav = (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div className="side-team" style={{ justifyContent: showLabels ? "flex-start" : "center", margin: showLabels ? undefined : "12px 8px 8px", padding: showLabels ? undefined : 8 }}>
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt="" style={{ height: 28, maxWidth: showLabels ? 150 : 28, objectFit: "contain" }} />
        ) : (
          <span style={{ width: 30, height: 30, borderRadius: 9, background: dark ? "rgba(255,255,255,.1)" : tint(b.primaryColor, 0.88), display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BrandMark size={18} color={dark ? "#FFFDF0" : b.primaryColor} />
          </span>
        )}
        {showLabels && (
          <div style={{ lineHeight: 1.15, minWidth: 0 }}>
            <div style={{ fontSize: 10, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Workspace</div>
            <div style={{ fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{b.productName || orgName}</div>
          </div>
        )}
      </div>
      {groups.map((g, gi) => {
        const items = g.items.filter((i) => i.show !== false);
        if (!items.length) return null;
        return (
          <div key={gi}>
            {g.label && showLabels && <div className="side-section">{g.label}</div>}
            <Menu theme={dark ? "dark" : "light"} mode="inline" inlineCollapsed={!showLabels} selectedKeys={[selected]} style={{ borderInlineEnd: 0, background: "transparent" }}
              items={items.map((i) => ({ key: i.key, icon: i.icon, label: <Link href={i.key === "/app/settings" ? "/app/settings/branding" : i.key}>{i.label}</Link> }))} />
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {isMobile ? (
        <Drawer placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} size={272} closable={false} styles={{ body: { padding: 0, background: dark ? "#022A24" : "#fff" }, header: { display: "none" } }}>
          <div style={{ background: dark ? "#022A24" : "#fff", minHeight: "100%", color: dark ? "#fff" : undefined }}>{nav}</div>
        </Drawer>
      ) : (
        <Sider collapsible collapsed={collapsed} trigger={null} width={248} collapsedWidth={72} theme={dark ? "dark" : "light"} style={{ position: "sticky", top: 0, height: "100vh", overflow: "auto", borderRight: `1px solid ${dark ? "rgba(255,255,255,.08)" : token.colorBorderSecondary}` }}>
          {nav}
        </Sider>
      )}
      <Layout>
        <Header style={{ background: token.colorBgContainer, padding: isMobile ? "0 10px" : "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${token.colorBorderSecondary}`, position: "sticky", top: 0, zIndex: 10, height: 60, lineHeight: "normal" }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, minWidth: 0, flex: 1 }}>
            {isMobile ? (
              <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} aria-label="Open navigation" />
            ) : (
              <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
            )}
            {isMobile && <BrandMark size={20} color={b.primaryColor} style={{ flexShrink: 0 }} />}
            {isMobile && <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{b.productName || orgName}</span>}
            {!isMobile && (
              <div style={{ lineHeight: 1.1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: token.colorTextTertiary, minHeight: 13 }}>{today}</div>
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{orgName}</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 12 }}>
            {!isMobile && (
              <Input ref={searchRef as never} value={search} onChange={(e) => setSearch(e.target.value)} onPressEnter={goSearch} prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />} placeholder="Search requests…" allowClear
                suffix={<span style={{ fontSize: 11, color: token.colorTextTertiary, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 5, padding: "0 5px" }}>⌘K</span>} style={{ width: 280, borderRadius: 8, background: token.colorFillAlter }} />
            )}
            <NotificationTray />
            <Dropdown
              menu={{
                items: [
                  { key: "who", label: <span><b>{me?.user.name || session.name}</b><br /><span className="muted" style={{ fontSize: 11 }}>{role.toLowerCase()}</span></span>, disabled: true },
                  { type: "divider" },
                  { key: "profile", icon: <UserOutlined />, label: <Link href="/app/profile">My profile</Link> },
                  { key: "security", icon: <SafetyCertificateOutlined />, label: <Link href="/app/profile?tab=security">Security{me?.user.twoFactorEnabled ? "" : " (2FA off)"}</Link> },
                  { key: "ooo", icon: <CalendarOutlined />, label: <Link href="/app/settings/delegations">Out of office</Link> },
                  { type: "divider" },
                  { key: "logout", icon: <LogoutOutlined />, label: "Sign out", onClick: logout },
                ],
              }}
            >
              <Space style={{ cursor: "pointer" }}>
                <Avatar src={me?.user.avatarUrl || undefined} style={{ background: b.primaryColor }}>{(me?.user.name || session.name).slice(0, 1).toUpperCase()}</Avatar>
                <div className="hide-mobile" style={{ lineHeight: 1.1 }}>
                  <Typography.Text strong>{me?.user.name || session.name}</Typography.Text>
                  <div className="muted" style={{ fontSize: 11 }}>{role.toLowerCase()}{me?.user.department ? ` · ${me.user.department.name}` : ""}</div>
                </div>
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content className="app-content">
          {mustSetup2fa && pathname !== "/app/profile" && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Two-factor authentication is required for administrators in this workspace."
              action={<Link href="/app/profile?tab=security"><Button size="small" type="primary">Set up now</Button></Link>} />
          )}
          {children}
        </Content>
        {b.footerText && (
          <div className="muted no-print" style={{ textAlign: "center", padding: "8px 0 16px", fontSize: 12 }}>
            {b.footerText}
          </div>
        )}
      </Layout>

      <Modal open={mustChangePassword} closable={false} mask={{ closable: false }} keyboard={false} title="Set a new password to continue" onOk={changePassword} confirmLoading={changing} okText="Update password" cancelButtonProps={{ style: { display: "none" } }}>
        <Typography.Paragraph type="secondary">You signed in with a temporary password. {PASSWORD_POLICY.description}</Typography.Paragraph>
        <Form form={pwForm} layout="vertical">
          <Form.Item name="currentPassword" label="Temporary password" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
          <Form.Item name="newPassword" label="New password" rules={[{ required: true, min: PASSWORD_POLICY.minLength }]}><Input.Password autoComplete="new-password" /></Form.Item>
          <Form.Item name="confirm" label="Confirm new password" dependencies={["newPassword"]} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, v) => (v === getFieldValue("newPassword") ? Promise.resolve() : Promise.reject(new Error("Passwords do not match"))) })]}><Input.Password autoComplete="new-password" /></Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
