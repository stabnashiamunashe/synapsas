"use client";

/**
 * Synapsas brand assets, sourced from the official PNGs in /public/images (trimmed copies live in /public/brand).
 * `color` picks the light or dark artwork: pass a light colour (cream/white) for dark backgrounds.
 */
function isLight(color?: string) {
  if (!color) return false;
  const c = color.toLowerCase();
  if (["white", "#fff", "#ffffff", "#fffdf0", "currentcolor"].includes(c)) return c !== "currentcolor";
  const m = c.match(/^#([0-9a-f]{6})$/);
  if (!m) return c.startsWith("rgba(255") || c.startsWith("rgb(255");
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export function BrandMark({ size = 32, color, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  const variant = isLight(color) ? "white" : "black";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/brand/mark-${variant}.png`} alt="" width={size} height={size} style={{ display: "inline-block", objectFit: "contain", ...style }} aria-hidden="true" />;
}

/** Full lockup (mark + wordmark) from the official artwork. */
export function BrandLogo({ color, height = 32, style }: { color?: string; height?: number; name?: string; style?: React.CSSProperties }) {
  const variant = isLight(color) ? "white" : "black";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/brand/logo-${variant}.png`} alt="Synapsas" height={height} style={{ display: "inline-block", height, width: "auto", ...style }} />;
}
