// Chart image for a portal dataset (PNG, 1200×675), rendered with Next's ImageResponse (satori + resvg) so it works
// without a browser or system fonts. Lines and axes are an inline SVG; all text is HTML so the bundled font is used.
import { ImageResponse } from "next/og";
import type { Series } from "./odp";

const W = 1200, H = 675;
const PAD = { left: 96, right: 36, top: 118, bottom: 160 };
const COLORS = ["#0f62fe", "#da1e28", "#198038", "#8a3ffc", "#ff832b", "#007d79"];

const nice = (lo: number, hi: number, n = 5) => {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
  const ticks: number[] = []; for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo: start, hi: end, ticks };
};
const trim = (s: string) => s.replace(/\.0$/, "");
const fmt = (v: number) => (Math.abs(v) >= 1e9 ? `${trim((v / 1e9).toFixed(1))}bn` : Math.abs(v) >= 1e6 ? `${trim((v / 1e6).toFixed(1))}m` : Math.abs(v) >= 1e4 ? `${Math.round(v / 1e3)}k` : Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1));

export async function renderLineChart(opts: { title: string; subtitle?: string; series: Series[]; footer: string }): Promise<Buffer> {
  const series = opts.series.filter((s) => s.points.length >= 1).slice(0, COLORS.length);
  const times = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p[0])))).sort();
  const values = series.flatMap((s) => s.points.map((p) => p[1]));
  const { lo, hi, ticks } = nice(Math.min(0, ...values), Math.max(0, ...values));
  const pw = W - PAD.left - PAD.right, ph = H - PAD.top - PAD.bottom;
  const x = (tm: string) => PAD.left + (times.length < 2 ? pw / 2 : (times.indexOf(tm) / (times.length - 1)) * pw);
  const y = (v: number) => PAD.top + ph - ((v - lo) / (hi - lo || 1)) * ph;
  const every = Math.max(1, Math.ceil(times.length / 10));
  const xLabels = times.filter((_, i) => i % every === 0 || i === times.length - 1);
  const dots = times.length <= 40;

  const el = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#ffffff", color: "#161616", fontFamily: "sans-serif", position: "relative" }}>
      <div style={{ position: "absolute", left: 36, top: 28, width: W - 72, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, lineHeight: 1.2, display: "flex" }}>{opts.title.slice(0, 120)}</div>
        {opts.subtitle ? <div style={{ fontSize: 17, color: "#6f6f6f", marginTop: 6, display: "flex" }}>{opts.subtitle.slice(0, 160)}</div> : null}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {ticks.map((tv) => <line key={`g${tv}`} x1={PAD.left} x2={W - PAD.right} y1={y(tv)} y2={y(tv)} stroke={tv === 0 ? "#8d8d8d" : "#e0e0e0"} strokeWidth={tv === 0 ? 1.5 : 1} />)}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + ph} stroke="#8d8d8d" strokeWidth={1.5} />
        {series.map((s, i) => {
          const pts = [...s.points].sort((a, b) => a[0].localeCompare(b[0]));
          const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ");
          return (
            <g key={s.label}>
              <path d={d} fill="none" stroke={COLORS[i]} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              {dots ? pts.map((p) => <circle key={p[0]} cx={x(p[0])} cy={y(p[1])} r={4} fill={COLORS[i]} />) : null}
            </g>
          );
        })}
      </svg>
      {ticks.map((tv) => <div key={`t${tv}`} style={{ position: "absolute", left: 0, width: PAD.left - 12, top: y(tv) - 10, display: "flex", justifyContent: "flex-end", fontSize: 15, color: "#525252" }}>{fmt(tv)}</div>)}
      {xLabels.map((tm) => <div key={`x${tm}`} style={{ position: "absolute", left: x(tm) - 50, width: 100, top: PAD.top + ph + 10, display: "flex", justifyContent: "center", fontSize: 15, color: "#525252" }}>{tm}</div>)}
      <div style={{ position: "absolute", left: PAD.left, right: PAD.right, top: PAD.top + ph + 44, display: "flex", flexWrap: "wrap", fontSize: 15, color: "#393939" }}>
        {series.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", marginRight: 22, marginBottom: 6 }}>
            <div style={{ width: 16, height: 16, background: COLORS[i], borderRadius: 3, marginRight: 8, display: "flex" }} />
            <div style={{ display: "flex" }}>{s.label.length > 70 ? `${s.label.slice(0, 69)}…` : s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 36, bottom: 22, fontSize: 14, color: "#8d8d8d", display: "flex" }}>{opts.footer}</div>
    </div>
  );
  const res = new ImageResponse(el, { width: W, height: H });
  return Buffer.from(await res.arrayBuffer());
}
