"use client";

import { Alert, App, Avatar, Button, Drawer, Dropdown, Form, Grid, Input, Layout, Menu, Modal, Space, Typography, theme } from "antd";
import { CalendarOutlined, LogoutOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, SafetyCertificateOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandProvider, DEFAULT_BRANDING, SHELL_DARK, tint } from "./Providers";
import { BrandMark } from "./BrandMark";
import { NotificationTray } from "./NotificationTray";
import { CommandPalette } from "./CommandPalette";
import { NavIcon } from "./NavIcon";
import { api, useMe } from "@/lib/client";
import type { BrandingSettings, SessionUser } from "@/lib/types";
import { PASSWORD_POLICY } from "@/lib/security";
import { activeNavKey, sidebarGroups } from "@/lib/nav";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: me, mutate } = useMe();
  const { token } = theme.useToken();
  const [pwForm] = Form.useForm();
  const [changing, setChanging] = useState(false);
  const b = { ...DEFAULT_BRANDING, ...branding };
  const dark = b.sidebarTheme === "dark";
  const role = me?.user.role || session.role;

  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  // Date is client-only to avoid server/client locale mismatches during hydration.
  const [today, setToday] = useState("");
  useEffect(() => { setToday(new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })); }, []);
  const groups = sidebarGroups(role).map((g) => ({
    label: g.label,
    items: g.items.map((i) => ({ key: i.key, icon: <NavIcon name={i.icon} />, label: i.key === "/app/inbox" && me?.pendingApprovals ? `${i.label} (${me.pendingApprovals})` : i.label })),
  }));
  const selected = activeNavKey(pathname, role);

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

  const mustChangePassword = !!me?.security?.mustChangePassword;
  const mustSetup2fa = !!me?.security?.mustSetup2fa && !mustChangePassword;
  const showLabels = isMobile || !collapsed;

  const nav = (
    <div className={`side-nav${dark ? " side-nav-dark" : ""}`} style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div className="side-team" style={{ justifyContent: showLabels ? "flex-start" : "center", margin: showLabels ? undefined : "12px 8px 8px", padding: showLabels ? undefined : 8 }}>
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt="" style={{ height: 28, maxWidth: showLabels ? 150 : 28, objectFit: "contain" }} />
        ) : (
          <span style={{ width: 32, height: 32, background: dark ? "rgba(255,255,255,.08)" : tint(b.primaryColor, 0.88), display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BrandMark size={18} color={dark ? SHELL_DARK.accent : b.primaryColor} />
          </span>
        )}
        {showLabels && (
          <div style={{ lineHeight: 1.15, minWidth: 0 }}>
            <div style={{ fontSize: 11, opacity: 0.65, letterSpacing: "0.32px" }}>Workspace</div>
            <div style={{ fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{b.productName || orgName}</div>
          </div>
        )}
      </div>
      {groups.map((g, gi) => {
        const items = g.items;
        if (!items.length) return null;
        return (
          <div key={gi}>
            {g.label && showLabels && <div className="side-section">{g.label}</div>}
            {!showLabels && gi > 0 && <div className="side-divider" />}
            <Menu theme={dark ? "dark" : "light"} mode="inline" inlineCollapsed={!showLabels} selectedKeys={[selected]} style={{ borderInlineEnd: 0, background: "transparent" }}
              items={items.map((i) => ({ key: i.key, icon: i.icon, label: <Link href={i.key}>{i.label}</Link>, title: i.label }))} />
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
      {showLabels && <div className="side-foot">{me?.user.name || session.name}<br /><span style={{ opacity: 0.6 }}>{role.toLowerCase()}{me?.user.department ? ` · ${me.user.department.name}` : ""}</span></div>}
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {isMobile ? (
        <Drawer placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} size={272} closable={false} styles={{ body: { padding: 0, background: dark ? SHELL_DARK.bg : "#fff" }, header: { display: "none" } }}>
          <div style={{ background: dark ? SHELL_DARK.bg : "#fff", minHeight: "100%", color: dark ? "#f4f4f4" : undefined }}>{nav}</div>
        </Drawer>
      ) : (
        <Sider collapsible collapsed={collapsed} trigger={null} width={256} collapsedWidth={64} theme={dark ? "dark" : "light"} style={{ position: "sticky", top: 0, height: "100vh", overflow: "auto", background: dark ? SHELL_DARK.bg : undefined, borderRight: `1px solid ${dark ? SHELL_DARK.border : token.colorBorderSecondary}` }}>
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
            {!isMobile ? (
              <div style={{ width: 340 }}><CommandPalette role={role} /></div>
            ) : (
              <Button type="text" icon={<SearchOutlined />} aria-label="Search" onClick={() => setSearchOpen(true)} />
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

      <Modal open={searchOpen} onCancel={() => setSearchOpen(false)} footer={null} title="Search" destroyOnHidden>
        <CommandPalette role={role} autoFocus hotkey={false} onNavigate={() => setSearchOpen(false)} />
      </Modal>

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
