"use client";

/** Ruwa Local Board crest (public/brand/ruwa-logo.jpg). The crest has a white ground, so it sits in a white tile on the dark shell. */
export function BrandMark({ size = 32, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/ruwa-logo.jpg" alt="" width={size} height={size} style={{ display: "inline-block", objectFit: "contain", background: "#fff", ...style }} aria-hidden="true" />;
}

export function BrandLogo({ height = 32, style }: { color?: string; height?: number; name?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/ruwa-logo.jpg" alt="Ruwa Local Board" height={height} style={{ display: "inline-block", height, width: "auto", ...style }} />;
}
