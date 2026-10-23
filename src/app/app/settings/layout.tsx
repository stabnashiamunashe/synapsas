"use client";

import { Grid, Menu, Typography } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const { data: me } = useMe();
  const isAdmin = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.ADMIN : false;
  const items = [
    ...(isAdmin ? [
      { key: "/app/settings/branding", label: <Link href="/app/settings/branding">Branding & white-label</Link> },
      { key: "/app/settings/organization", label: <Link href="/app/settings/organization">Organisation & security</Link> },
      { key: "/app/settings/api", label: <Link href="/app/settings/api">API & webhooks</Link> },
    ] : []),
    { key: "/app/settings/delegations", label: <Link href="/app/settings/delegations">Out of office</Link> },
  ];
  return (
    <div>
      <Typography.Title level={3} className="page-title" style={{ marginBottom: 16 }}>Settings</Typography.Title>
      <div style={{ display: "flex", gap: isMobile ? 12 : 24, alignItems: "flex-start", flexDirection: isMobile ? "column" : "row" }}>
        <Menu mode={isMobile ? "horizontal" : "inline"} selectedKeys={[pathname]} items={items} style={isMobile ? { width: "100%" } : { width: 240 }} />
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>{children}</div>
      </div>
    </div>
  );
}
