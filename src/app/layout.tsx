import type { Metadata } from "next";
import { headers } from "next/headers";
import { AntdRegistry } from "@/components/AntdRegistry";
import "@ant-design/v5-patch-for-react-19";
import "./globals.css";

// System font stack (see --font-sans in globals.css): no external stylesheet or font download under the strict CSP.

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "ZimStat Approvals",
  description: "Zimbabwe National Statistics Agency: travel and subsistence advances and claims, leave applications and internal approvals.",
  icons: { icon: "/favicon.png" },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#1414D2" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce set by src/proxy.ts; applied to Ant Design's injected styles.
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="en">
      <body>
        <AntdRegistry nonce={nonce}>{children}</AntdRegistry>
      </body>
    </html>
  );
}
