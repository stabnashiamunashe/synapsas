"use client";

/**
 * Global search (Ctrl/⌘ K): every page in the application, plus live matches from requests and service desk cases.
 * Pages come from the navigation registry in src/lib/nav.ts, so anything added there is immediately searchable.
 */
import { AutoComplete, Input, Tag } from "antd";
import { ArrowRightOutlined, SearchOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { Role } from "@/lib/types";
import { NAV_GROUP_ORDER, searchNav } from "@/lib/nav";
import { NavIcon } from "./NavIcon";

interface ReqHit { id: string; referenceNo: string; title: string; status: string }
interface CaseHit { id: string; referenceNo: string; title: string; status: string }

export function CommandPalette({ role, style, autoFocus, onNavigate, hotkey = true }: { role: Role; style?: React.CSSProperties; autoFocus?: boolean; onNavigate?: () => void; hotkey?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<{ requests: ReqHit[]; cases: CaseHit[] }>({ requests: [], cases: [] });
  const ref = useRef<{ focus: () => void; blur: () => void } | null>(null);

  useEffect(() => {
    if (!hotkey) return;
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ref.current?.focus(); setOpen(true); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [hotkey]);

  // live record search, debounced
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits({ requests: [], cases: [] }); return; }
    const t = setTimeout(async () => {
      const [r, c] = await Promise.all([
        api<{ items?: ReqHit[] } | ReqHit[]>(`/api/requests?q=${encodeURIComponent(term)}&pageSize=5&scope=all`).catch(() => null),
        api<{ items?: CaseHit[] } | CaseHit[]>(`/api/cases?q=${encodeURIComponent(term)}&pageSize=5`).catch(() => null),
      ]);
      const list = <T,>(x: { items?: T[] } | T[] | null) => (Array.isArray(x) ? x : x?.items || []) as T[];
      setHits({ requests: list<ReqHit>(r).slice(0, 5), cases: list<CaseHit>(c).slice(0, 5) });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const pages = useMemo(() => searchNav(role, q), [role, q]);
  const go = (value: string) => {
    if (value.startsWith("search:")) router.push(`/app/requests?q=${encodeURIComponent(value.slice(7))}`);
    else if (value.startsWith("ext:")) window.open(value.slice(4), "_blank", "noopener");
    else router.push(value);
    setQ(""); setOpen(false); ref.current?.blur(); onNavigate?.();
  };

  const row = (icon: React.ReactNode, title: React.ReactNode, sub?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 0" }}>
      <span style={{ width: 18, display: "inline-flex", justifyContent: "center", color: "var(--text-secondary)" }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {sub && <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </span>
    </div>
  );

  const term = q.trim();
  const pageGroups = NAV_GROUP_ORDER.map((g) => ({ g, items: pages.filter((p) => p.group === g).slice(0, term ? 6 : 12) })).filter((x) => x.items.length);
  const options = [
    ...pageGroups.map(({ g, items }) => ({
      label: <span style={{ fontSize: 12, letterSpacing: 0.32 }}>{g}</span>,
      options: items.map((p) => ({ value: p.external ? `ext:${p.key}` : p.key, label: row(<NavIcon name={p.icon} />, <span>{p.label}{p.external && <Tag style={{ marginLeft: 8 }}>opens in new tab</Tag>}</span>, p.description) })),
    })),
    ...(hits.requests.length ? [{ label: <span style={{ fontSize: 12 }}>Requests</span>, options: hits.requests.map((r) => ({ value: `/app/requests/${r.id}`, label: row(<NavIcon name="file" />, <span><span className="mono muted" style={{ marginRight: 8 }}>{r.referenceNo}</span>{r.title}</span>, r.status.toLowerCase()) })) }] : []),
    ...(hits.cases.length ? [{ label: <span style={{ fontSize: 12 }}>Service desk cases</span>, options: hits.cases.map((c) => ({ value: `/app/cases?open=${c.id}`, label: row(<NavIcon name="support" />, <span><span className="mono muted" style={{ marginRight: 8 }}>{c.referenceNo}</span>{c.title}</span>, c.status.replace(/_/g, " ").toLowerCase()) })) }] : []),
    ...(term ? [{ label: <span style={{ fontSize: 12 }}>More</span>, options: [{ value: `search:${term}`, label: row(<ArrowRightOutlined />, <span>Search all requests for “{term}”</span>) }] }] : []),
  ];

  return (
    <AutoComplete
      ref={ref as never}
      value={q}
      open={open}
      onOpenChange={setOpen}
      onChange={(v) => setQ(v)}
      onSelect={(v) => go(String(v))}
      options={options}
      filterOption={false}
      style={{ width: "100%", ...style }}
      styles={{ popup: { root: { width: 520, maxWidth: "calc(100vw - 32px)" } } }}
      popupMatchSelectWidth={false}
      listHeight={420}
      autoFocus={autoFocus}
    >
      <Input
        prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
        placeholder="Search pages, requests and cases"
        allowClear
        onPressEnter={() => { if (term) go(pages[0] && !hits.requests.length ? (pages[0].external ? `ext:${pages[0].key}` : pages[0].key) : `search:${term}`); }}
        suffix={<span aria-hidden style={{ fontSize: 11, color: "var(--text-muted)", border: "1px solid var(--border)", padding: "0 5px", lineHeight: "18px" }}>Ctrl K</span>}
      />
    </AutoComplete>
  );
}
