"use client";

import { Alert, Button, Space, Typography } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandProvider, DEFAULT_BRANDING } from "./Providers";
import { api } from "@/lib/client";

export interface PortalConfig {
  orgName: string; branding: { productName?: string; logoUrl?: string; primaryColor?: string; footerText?: string }; enabled: boolean;
  heading: string; subtext: string; contactEmail: string | null; contactPhone: string | null; announcement: string | null;
  categories: { id: string; name: string; description?: string | null; icon?: string | null; defaultSlaHours: number; department: { name: string } }[];
}

/** Frame for the public report/track pages: agency header, announcement, footer with contacts. */
export function PublicShell({ children, onConfig, active }: { children: (cfg: PortalConfig | null) => React.ReactNode; onConfig?: (c: PortalConfig) => void; active: "report" | "track" }) {
  const [cfg, setCfg] = useState<PortalConfig | null>(null);
  useEffect(() => { api<PortalConfig>("/api/public/portal").then((c) => { setCfg(c); onConfig?.(c); }).catch(() => setCfg(null)); }, [onConfig]);
  const b = { ...DEFAULT_BRANDING, ...(cfg?.branding || {}) };
  return (
    <BrandProvider branding={cfg?.branding}>
      <div style={{ minHeight: "100vh", background: "#f4f5f7" }}>
        <header style={{ background: "#fff", borderBottom: `3px solid ${b.primaryColor}`, padding: "12px 20px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <Link href="/report" style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logoUrl || "/brand/zimstat-logo.png"} alt="" style={{ height: 44 }} />
              <div><div style={{ fontWeight: 700 }}>{cfg?.orgName || b.productName}</div><div className="muted" style={{ fontSize: 12 }}>Service requests and reports</div></div>
            </Link>
            <Space>
              <Link href="/report"><Button type={active === "report" ? "primary" : "default"}>Report an issue</Button></Link>
              <Link href="/track"><Button type={active === "track" ? "primary" : "default"}>Track a report</Button></Link>
              <Link href="/login"><Button type="text">Staff sign in</Button></Link>
            </Space>
          </div>
        </header>
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 48px" }}>
          {cfg?.announcement && <Alert type="info" showIcon banner title={cfg.announcement} style={{ marginBottom: 16, borderRadius: 8 }} />}
          {children(cfg)}
        </main>
        <footer className="muted" style={{ textAlign: "center", padding: "16px", fontSize: 12 }}>
          {cfg?.branding.footerText || cfg?.orgName}{cfg?.contactEmail ? ` · ${cfg.contactEmail}` : ""}{cfg?.contactPhone ? ` · ${cfg.contactPhone}` : ""}
          <Typography.Paragraph type="secondary" style={{ fontSize: 11, marginTop: 4, marginBottom: 0 }}>Personal details are used only to update you on your report.</Typography.Paragraph>
        </footer>
      </div>
    </BrandProvider>
  );
}
