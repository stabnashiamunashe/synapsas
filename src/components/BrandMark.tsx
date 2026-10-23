"use client";

/** ZimStat brand artwork (public/brand/zimstat-logo.png). The emblem reads on light backgrounds; keep the sidebar light. */
export function BrandMark({ size = 32, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/zimstat-logo.png" alt="" width={size} height={size} style={{ display: "inline-block", objectFit: "contain", ...style }} aria-hidden="true" />;
}

export function BrandLogo({ height = 32, style }: { color?: string; height?: number; name?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/zimstat-logo.png" alt="ZimStat" height={height} style={{ display: "inline-block", height, width: "auto", ...style }} />;
}
