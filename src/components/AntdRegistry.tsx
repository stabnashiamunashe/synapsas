"use client";

// Ant Design SSR style registry with CSP nonce support. Mirrors @ant-design/nextjs-registry but stamps the
// per-request nonce (from src/proxy.ts) on the server-inserted <style> tag and on client-side CSS-in-JS.
import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs";
import { useServerInsertedHTML } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

export const NonceContext = createContext<string | undefined>(undefined);
export const useNonce = () => useContext(NonceContext);

export function AntdRegistry({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const [cache] = useState(() => createCache());
  useServerInsertedHTML(() => {
    const styleText = extractStyle(cache, { plain: true, once: true });
    if (styleText.includes('.data-ant-cssinjs-cache-path{content:"";}')) return null;
    return <style id="antd-cssinjs" nonce={nonce} data-rc-order="prepend" data-rc-priority="-1000" dangerouslySetInnerHTML={{ __html: styleText }} />;
  });
  return (
    <NonceContext.Provider value={nonce}>
      <StyleProvider cache={cache}>{children}</StyleProvider>
    </NonceContext.Provider>
  );
}
