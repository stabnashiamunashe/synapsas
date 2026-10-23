"use client";

import { Card, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { BrandProvider, DEFAULT_BRANDING } from "./Providers";
import type { BrandingSettings } from "@/lib/types";
import { api } from "@/lib/client";

export interface PublicBrand { name: string; slug: string; branding: BrandingSettings }

/** Wraps public auth pages and applies tenant branding from ?org=<slug> or the custom domain. */
export function AuthShell({ slug, title, subtitle, children, onBrand }: {
  slug?: string | null; title: string; subtitle?: string; children: React.ReactNode; onBrand?: (b: PublicBrand | null) => void;
}) {
  const [brand, setBrand] = useState<PublicBrand | null>(null);
  useEffect(() => {
    api<PublicBrand | null>(`/api/public/branding${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`)
      .then((b) => { setBrand(b); onBrand?.(b); })
      .catch(() => setBrand(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  const b = { ...DEFAULT_BRANDING, ...(brand?.branding || {}) };
  const productName = b.productName || brand?.name || DEFAULT_BRANDING.productName;
  return (
    <BrandProvider branding={brand?.branding}>
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        background: b.loginBackgroundUrl ? `url(${b.loginBackgroundUrl}) center/cover` : "#eef0f3",
      }}>
        <Card style={{ width: 420, maxWidth: "100%", borderTop: `4px solid ${b.primaryColor}` }} styles={{ body: { padding: 32 } }}>
          <Space orientation="vertical" align="center" style={{ width: "100%", marginBottom: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.logoUrl || "/brand/zimstat-logo.png"} alt={productName} style={{ height: 96, maxWidth: 240, objectFit: "contain" }} />
            <Typography.Title level={3} style={{ margin: 0 }}>{productName}</Typography.Title>
            {b.loginTagline && <Typography.Text type="secondary">{b.loginTagline}</Typography.Text>}
          </Space>
          <Typography.Title level={4} style={{ marginTop: 0 }}>{title}</Typography.Title>
          {subtitle && <Typography.Paragraph type="secondary">{subtitle}</Typography.Paragraph>}
          {children}
        </Card>
      </div>
    </BrandProvider>
  );
}
