"use client";

import { App as AntApp, ConfigProvider, theme as antTheme } from "antd";
import { useNonce } from "./AntdRegistry";
import { useEffect } from "react";
import type { BrandingSettings } from "@/lib/types";

/** Defaults: ZimStat blue primary on IBM Carbon surfaces (IBM Plex, square corners, gray-10 canvas). Overridable under Settings → Branding. */
export const DEFAULT_BRANDING: Required<Pick<BrandingSettings, "productName" | "primaryColor" | "sidebarTheme" | "borderRadius">> = {
  productName: process.env.NEXT_PUBLIC_APP_NAME || "ZimStat Approvals",
  primaryColor: "#1414D2", // ZimStat blue (logo wordmark)
  sidebarTheme: "dark",
  borderRadius: 0,
};

/** IBM Carbon UI-shell dark palette (gray 100) with the ZimStat gold as the selection accent. */
export const SHELL_DARK = { bg: "#161616", layer: "#262626", hover: "#353535", selected: "#393939", border: "#393939", text: "#f4f4f4", textSecondary: "#c6c6c6", accent: "#F0D040" };

/** ZimStat palette from the agency logo: blue wordmark, red star, gold bird, black. */
export const BRAND = { blue: "#1414D2", blueDeep: "#0B0B8F", red: "#D7262D", gold: "#F0D040", black: "#000000", white: "#FFFFFF", cream: "#FFFFFF" };

/** IBM Carbon "white" theme neutrals (gray 10 canvas, gray 20 borders, gray 100 text). */
export const UI = {
  pageBg: "#f4f4f4",
  surface: "#ffffff",
  sidebarBg: "#ffffff",
  border: "#e0e0e0",
  borderStrong: "#8d8d8d",
  text: "#161616",
  textSecondary: "#525252",
  textMuted: "#6f6f6f",
  tableHeaderBg: "#f4f4f4",
  hover: "#e8e8e8",
  focus: "#0f62fe",
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
  const radius = Math.min(Math.max(b.borderRadius ?? 0, 0), 24);
  const nonce = useNonce();
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
      csp={nonce ? { nonce } : undefined}
      theme={{
        algorithm: antTheme.defaultAlgorithm,
        token: {
          colorPrimary: b.primaryColor,
          colorInfo: b.primaryColor,
          colorLink: b.primaryColor,
          borderRadius: radius,
          borderRadiusLG: radius,
          borderRadiusSM: radius,
          borderRadiusXS: radius,
          fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
          fontFamilyCode: "'IBM Plex Mono', Menlo, Consolas, monospace",
          fontSize: 14,
          fontSizeHeading1: 32, fontSizeHeading2: 28, fontSizeHeading3: 20, fontSizeHeading4: 16, fontSizeHeading5: 14,
          fontWeightStrong: 600,
          lineHeight: 1.43,
          colorText: UI.text,
          colorTextSecondary: UI.textSecondary,
          colorTextTertiary: UI.textMuted,
          colorBorder: UI.borderStrong,
          colorBorderSecondary: UI.border,
          colorBgLayout: UI.pageBg,
          colorBgContainer: UI.surface,
          colorFillAlter: UI.tableHeaderBg,
          controlHeight: 40,
          controlHeightSM: 32,
          controlHeightLG: 48,
          controlOutline: "rgba(15, 98, 254, 0)",
          controlOutlineWidth: 0,
          boxShadow: "0 2px 6px rgba(0,0,0,.2)",
          boxShadowSecondary: "0 2px 6px rgba(0,0,0,.2)",
          motionDurationMid: "0.11s",
          wireframe: false,
        },
        components: {
          Layout: { siderBg: b.sidebarTheme === "dark" ? SHELL_DARK.bg : UI.sidebarBg, headerBg: UI.surface, bodyBg: UI.pageBg },
          Menu: {
            itemBorderRadius: 0,
            subMenuItemBorderRadius: 0,
            itemMarginInline: 0,
            itemMarginBlock: 0,
            itemHeight: 40,
            itemSelectedBg: "#e0e0e0",
            itemSelectedColor: UI.text,
            itemHoverBg: UI.hover,
            darkItemBg: SHELL_DARK.bg,
            darkSubMenuItemBg: SHELL_DARK.bg,
            darkItemSelectedBg: SHELL_DARK.selected,
            darkItemHoverBg: SHELL_DARK.hover,
            darkItemColor: SHELL_DARK.textSecondary,
            darkItemHoverColor: SHELL_DARK.text,
            darkItemSelectedColor: SHELL_DARK.text,
            darkPopupBg: SHELL_DARK.layer,
            iconSize: 16,
          },
          Card: { headerBg: "transparent", headerFontSize: 16, headerFontSizeSM: 14, headerHeight: 56, paddingLG: 24, borderRadiusLG: radius, colorBorderSecondary: UI.border },
          Table: { headerBg: "#e0e0e0", headerColor: UI.text, headerSplitColor: "transparent", cellPaddingBlock: 12, cellPaddingInline: 16, borderColor: UI.border, rowHoverBg: UI.hover, headerBorderRadius: 0, fontWeightStrong: 600 },
          Button: {
            borderRadius: radius, borderRadiusLG: radius, borderRadiusSM: radius, fontWeight: 400, paddingInline: 16, paddingInlineSM: 12,
            primaryShadow: "none", defaultShadow: "none", dangerShadow: "none",
            defaultBg: UI.surface, defaultBorderColor: UI.text, defaultColor: UI.text, defaultHoverBg: UI.hover, defaultHoverBorderColor: UI.text, defaultHoverColor: UI.text, defaultActiveBg: "#c6c6c6",
            textHoverBg: UI.hover, contentFontSizeSM: 14, onlyIconSize: 16,
          },
          Input: { borderRadius: radius, borderRadiusLG: radius, borderRadiusSM: radius, activeShadow: "none", activeBorderColor: UI.focus, hoverBorderColor: UI.borderStrong, paddingInline: 16, colorBgContainer: UI.surface },
          InputNumber: { borderRadius: radius, hoverBorderColor: UI.borderStrong, activeBorderColor: UI.focus },
          Select: { borderRadius: radius, borderRadiusLG: radius, optionSelectedBg: "#e0e0e0", optionSelectedFontWeight: 600, hoverBorderColor: UI.borderStrong, activeBorderColor: UI.focus, optionPadding: "9px 16px" },
          DatePicker: { borderRadius: radius, hoverBorderColor: UI.borderStrong, activeBorderColor: UI.focus },
          Tag: { borderRadiusSM: 24, defaultBg: "#e0e0e0", defaultColor: UI.text, fontSizeSM: 12 },
          Modal: { titleFontSize: 20, borderRadiusLG: radius, paddingContentHorizontalLG: 24 },
          Drawer: { paddingLG: 24 },
          Dropdown: { borderRadiusLG: radius, paddingBlock: 8 },
          Popover: { borderRadiusLG: radius },
          Tooltip: { borderRadius: radius, colorBgSpotlight: "#393939" },
          Descriptions: { labelBg: UI.tableHeaderBg, labelColor: UI.textSecondary },
          Tabs: { titleFontSize: 14, inkBarColor: b.primaryColor, itemSelectedColor: UI.text, itemHoverColor: UI.text, horizontalItemGutter: 24, horizontalItemPadding: "12px 0" },
          Segmented: { itemSelectedBg: UI.text, itemSelectedColor: "#ffffff", itemColor: UI.textSecondary, itemHoverColor: UI.text, itemHoverBg: "#e0e0e0", trackBg: "#e0e0e0", trackPadding: 0, borderRadius: radius, borderRadiusSM: radius },
          Checkbox: { borderRadiusSM: radius },
          Switch: { trackHeight: 24, handleSize: 18 },
          Avatar: { containerSize: 32 },
          Badge: { dotSize: 8 },
          Pagination: { itemBg: UI.surface, itemActiveBg: UI.text, borderRadius: radius },
          Steps: { iconSize: 24 },
          Statistic: { contentFontSize: 28, titleFontSize: 12 },
          Alert: { borderRadiusLG: radius },
          Progress: { defaultColor: b.primaryColor },
          Typography: { titleMarginBottom: 0 },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
