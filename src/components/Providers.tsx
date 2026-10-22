"use client";

import { App as AntApp, ConfigProvider, theme as antTheme } from "antd";
import { useEffect } from "react";
import type { BrandingSettings } from "@/lib/types";

/** Defaults: Synapsas green primary, light surfaces, soft radii, pill controls. Tenants override via branding. */
export const DEFAULT_BRANDING: Required<Pick<BrandingSettings, "productName" | "primaryColor" | "sidebarTheme" | "borderRadius">> = {
  productName: process.env.NEXT_PUBLIC_APP_NAME || "Synapsas",
  primaryColor: "#003B32", // Synapsas deep green
  sidebarTheme: "light",
  borderRadius: 12,
};

/** Synapsas palette: deep green, cream, black. */
export const BRAND = { green: "#003B32", greenDeep: "#022A24", cream: "#FFFDF0", black: "#000000", white: "#FFFFFF" };

/** Neutral UI surfaces (light, airy dashboard look). */
export const UI = {
  pageBg: "#f5f6f8",
  surface: "#ffffff",
  sidebarBg: "#ffffff",
  border: "#e6e8ec",
  borderStrong: "#d5d9e0",
  text: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9aa3b2",
  tableHeaderBg: "#fafbfc",
  hover: "#f3f4f6",
};

/** Mix a hex colour with white for tinted backgrounds. */
export function tint(hex: string, amount = 0.9) {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const n = parseInt(m, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function BrandProvider({ branding, children }: { branding?: BrandingSettings | null; children: React.ReactNode }) {
  const b = { ...DEFAULT_BRANDING, ...(branding || {}) };
  const radius = Math.min(Math.max(b.borderRadius ?? 12, 0), 24);
  useEffect(() => {
    document.documentElement.style.setProperty("--brand-color", b.primaryColor);
    document.documentElement.style.setProperty("--brand-tint", tint(b.primaryColor, 0.9));
    document.documentElement.style.setProperty("--brand-radius", `${radius}px`);
    if (b.productName) document.title = b.productName;
    if (b.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = b.faviconUrl;
    }
  }, [b.primaryColor, b.productName, b.faviconUrl, radius]);

  return (
    <ConfigProvider
      theme={{
        algorithm: antTheme.defaultAlgorithm,
        token: {
          colorPrimary: b.primaryColor,
          colorInfo: b.primaryColor,
          colorLink: b.primaryColor,
          borderRadius: Math.max(6, radius - 2),
          borderRadiusLG: radius + 4,
          borderRadiusSM: Math.max(4, radius - 4),
          borderRadiusXS: 4,
          fontFamily: "var(--font-sans), 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          fontSize: 13,
          colorText: UI.text,
          colorTextSecondary: UI.textSecondary,
          colorTextTertiary: UI.textMuted,
          colorBorder: UI.borderStrong,
          colorBorderSecondary: UI.border,
          colorBgLayout: UI.pageBg,
          colorBgContainer: UI.surface,
          colorFillAlter: UI.tableHeaderBg,
          controlHeight: 36,
          controlHeightSM: 28,
          controlHeightLG: 44,
          boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)",
          boxShadowSecondary: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)",
          wireframe: false,
        },
        components: {
          Layout: { siderBg: b.sidebarTheme === "dark" ? BRAND.greenDeep : UI.sidebarBg, headerBg: UI.surface, bodyBg: UI.pageBg },
          Menu: {
            itemBorderRadius: 10,
            subMenuItemBorderRadius: 10,
            itemMarginInline: 8,
            itemMarginBlock: 2,
            itemHeight: 38,
            itemSelectedBg: tint(b.primaryColor, 0.9),
            itemSelectedColor: b.primaryColor,
            itemHoverBg: UI.hover,
            darkItemBg: BRAND.greenDeep,
            darkSubMenuItemBg: BRAND.greenDeep,
            darkItemSelectedBg: "rgba(255,255,255,0.14)",
            darkItemHoverBg: "rgba(255,255,255,0.06)",
            iconSize: 16,
          },
          Card: { headerBg: "transparent", headerFontSize: 14, headerHeight: 52, paddingLG: 20, borderRadiusLG: radius + 4, colorBorderSecondary: UI.border },
          Table: { headerBg: UI.tableHeaderBg, headerColor: UI.textSecondary, headerSplitColor: "transparent", cellPaddingBlock: 12, borderColor: UI.border, rowHoverBg: UI.hover, headerBorderRadius: 12 },
          Button: {
            borderRadius: 8, borderRadiusLG: 10, borderRadiusSM: 6, fontWeight: 500, paddingInline: 16, paddingInlineSM: 12,
            primaryShadow: "none", defaultShadow: "0 1px 2px rgba(16,24,40,.05)", dangerShadow: "none",
            defaultBg: UI.surface, defaultBorderColor: UI.border, defaultColor: UI.text, defaultHoverBg: UI.hover, defaultHoverBorderColor: UI.borderStrong, defaultHoverColor: UI.text, defaultActiveBg: "#e9ebef",
            textHoverBg: UI.hover, contentFontSizeSM: 12, onlyIconSize: 16,
          },
          Input: { borderRadius: 8, borderRadiusLG: 10, borderRadiusSM: 6, activeShadow: `0 0 0 3px ${tint(b.primaryColor, 0.85)}`, hoverBorderColor: UI.borderStrong, paddingInline: 12 },
          InputNumber: { borderRadius: 8, hoverBorderColor: UI.borderStrong },
          Select: { borderRadius: 8, borderRadiusLG: 10, optionSelectedBg: tint(b.primaryColor, 0.9), optionSelectedFontWeight: 500, hoverBorderColor: UI.borderStrong, optionPadding: "7px 10px" },
          DatePicker: { borderRadius: 8, hoverBorderColor: UI.borderStrong },
          Tag: { borderRadiusSM: 999, defaultBg: UI.hover, defaultColor: UI.textSecondary },
          Modal: { titleFontSize: 16, borderRadiusLG: 18, paddingContentHorizontalLG: 24 },
          Drawer: { paddingLG: 20 },
          Dropdown: { borderRadiusLG: 14, paddingBlock: 8 },
          Popover: { borderRadiusLG: 14 },
          Tooltip: { borderRadius: 8 },
          Descriptions: { labelBg: UI.tableHeaderBg },
          Tabs: { titleFontSize: 13, inkBarColor: UI.text, itemSelectedColor: UI.text, itemHoverColor: UI.text, horizontalItemGutter: 24 },
          Segmented: { itemSelectedBg: UI.text, itemSelectedColor: "#ffffff", itemColor: UI.textSecondary, itemHoverColor: UI.text, itemHoverBg: "#e9ebef", trackBg: UI.hover, trackPadding: 3, borderRadius: 8, borderRadiusSM: 6 },
          Checkbox: { borderRadiusSM: 5 },
          Switch: { trackHeight: 22, handleSize: 18 },
          Avatar: { containerSize: 32 },
          Badge: { dotSize: 8 },
          Pagination: { itemBg: UI.surface, itemActiveBg: UI.text, borderRadius: 8 },
          Steps: { iconSize: 26 },
          Statistic: { contentFontSize: 26, titleFontSize: 12 },
          Alert: { borderRadiusLG: 12 },
          Progress: { defaultColor: b.primaryColor },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
