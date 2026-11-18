"use client";

import { App, Button, Card, Col, Empty, Input, Row, Space, Tag, Tooltip, Typography } from "antd";
import { SendOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, formatDate, timeAgo, useApi } from "@/lib/client";
import { StatusPill } from "@/components/cases/CaseBits";
import type { CaseStatus } from "@/lib/caseTypes";
import { caseHref } from "./Overview";

interface Row { id: string; phone: string; profileName: string | null; step: string; lastInteractionAt: string; createdAt: string; last: { body: string; direction: string; createdAt: string } | null; messages: number; cases: { total: number; open: number }; handedOut: number }
interface Detail {
  id: string; phone: string; phoneFull: string | null; profileName: string | null; step: string; lastInteractionAt: string; createdAt: string; inWindow: boolean; configured: boolean;
  messages: { id: string; direction: string; kind: string; body: string; status: string; error: string | null; caseId: string | null; createdAt: string }[];
  cases: { id: string; referenceNo: string; title: string; status: string; createdAt: string; liveChat: boolean }[];
  subscription: { topics: string[]; frequency: string; isActive: boolean; createdAt: string } | null;
  handedOut: { id: string; kind: string; title: string; topicName: string | null; format: string | null; createdAt: string }[];
}

const STEP_LABEL: Record<string, string> = { IDLE: "idle", MENU: "at the menu", STATS_GROUP: "statistics", STATS_TOPIC: "statistics", STATS_IND: "statistics", STATS_AFTER: "statistics", STATS_FILES: "statistics files", STATS_DS: "portal datasets", STATS_DS_FMT: "portal datasets", FLOW: "filling a form", FLOW_SUMMARY: "reviewing a form", FLOW_EDIT: "editing a form", VR_KIND: "verification", VR_BADGE: "verification", VR_FOUND: "verification", VR_SURVEY: "verification", REL_TOPICS: "alerts", REL_FREQ: "alerts", CHAT_TOPIC: "live chat", CHAT: "in a live chat", TRACK: "tracking", RATE: "rating", EXIT_CONFIRM: "leaving" };

/** Every number that has talked to the bot, with the full transcript, their cases, alerts and the data they were given. */
export function Conversations() {
  const { message } = App.useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: list, isLoading } = useApi<Row[]>(`/api/chatbot/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`, { refreshInterval: 15000 });
  const { data: d, mutate } = useApi<Detail>(open ? `/api/chatbot/conversations/${open}` : null, { refreshInterval: 8000 });
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [d?.messages.length, open]);

  const send = async () => {
    if (!d || !text.trim()) return;
    setBusy(true);
    try { const r = await api<{ sent: boolean }>(`/api/chatbot/conversations/${d.id}`, { method: "POST", json: { text: text.trim() } }); setText(""); if (!r.sent) message.warning("WhatsApp did not accept the message (not configured, or outside the 24-hour window); it is in the log."); mutate(); } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card size="small" title={<Input.Search allowClear placeholder="Last digits of the number or name" onSearch={setQ} size="small" />} styles={{ body: { padding: 0, maxHeight: 680, overflowY: "auto" } }} loading={isLoading && !list}>
          {list && list.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No conversations yet" style={{ padding: 24 }} />}
          {(list || []).map((r) => (
            <div key={r.id} onClick={() => setOpen(r.id)} style={{ padding: "10px 12px", borderBottom: "1px solid #eef0f3", cursor: "pointer", background: open === r.id ? "#eef4ff" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.profileName || "WhatsApp user"} <span className="mono muted" style={{ fontWeight: 400, fontSize: 12 }}>{r.phone}</span></b>
                <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(r.lastInteractionAt)}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.last ? `${r.last.direction === "IN" ? "" : "Bot: "}${r.last.body.replace(/\s+/g, " ")}` : "–"}</div>
              <Space size={4} wrap style={{ marginTop: 4 }}>
                <Tag style={{ marginInlineEnd: 0 }} color={r.step === "CHAT" ? "green" : undefined}>{STEP_LABEL[r.step] || r.step.toLowerCase()}</Tag>
                <span className="muted" style={{ fontSize: 11 }}>{r.messages} messages{r.cases.total ? ` · ${r.cases.total} case${r.cases.total > 1 ? "s" : ""}${r.cases.open ? ` (${r.cases.open} open)` : ""}` : ""}{r.handedOut ? ` · ${r.handedOut} items of data` : ""}</span>
              </Space>
            </div>
          ))}
        </Card>
      </Col>
      <Col xs={24} lg={15}>
        {!d ? (
          <Card size="small" style={{ minHeight: 400 }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a conversation on the left" style={{ marginTop: 120 }} /></Card>
        ) : (
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <Card size="small" title={<Space wrap><b>{d.profileName || "WhatsApp user"}</b><span className="mono muted">{d.phoneFull || d.phone}</span><Tag color={d.step === "CHAT" ? "green" : undefined}>{STEP_LABEL[d.step] || d.step.toLowerCase()}</Tag></Space>} extra={<span className="muted" style={{ fontSize: 12 }}>first seen {formatDate(d.createdAt)} · last {timeAgo(d.lastInteractionAt)}</span>}>
              <div style={{ background: "#e5ddd5", borderRadius: 8, padding: 12, height: 420, overflowY: "auto" }}>
                {d.messages.map((m) => {
                  const out = m.direction === "OUT";
                  const system = m.kind === "system";
                  if (system) return <div key={m.id} className="muted" style={{ textAlign: "center", fontSize: 12, margin: "6px 0" }}>{m.body} · {timeAgo(m.createdAt)}</div>;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", marginBottom: 8 }}>
                      <div style={{ maxWidth: "80%", background: out ? "#dcf8c6" : "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 13, boxShadow: "0 1px 1px rgba(0,0,0,.08)", overflowWrap: "anywhere" }}>
                        <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                        <div style={{ fontSize: 10, color: "#98a2b3", textAlign: "right", marginTop: 2 }} title={formatDate(m.createdAt, true)}>
                          {out && <Tooltip title={m.error || undefined}><Tag style={{ fontSize: 10, lineHeight: "14px", marginInlineEnd: 4 }} color={m.status === "failed" ? "red" : m.status === "skipped" || m.status === "simulated" ? "default" : "green"}>{m.status}</Tag></Tooltip>}
                          {new Date(m.createdAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <Space.Compact style={{ width: "100%", marginTop: 8 }}>
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={d.configured && !d.inWindow ? "Outside the 24-hour window: WhatsApp only allows templates until they write again" : "Send a message to this number"} disabled={d.configured && !d.inWindow} onPressEnter={send} />
                <Button type="primary" icon={<SendOutlined />} loading={busy} disabled={!text.trim() || (d.configured && !d.inWindow)} onClick={send}>Send</Button>
              </Space.Compact>
            </Card>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Card size="small" title={`Cases (${d.cases.length})`}>
                  {d.cases.length === 0 && <span className="muted">None</span>}
                  {d.cases.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Link href={caseHref(c)}><span className="mono">{c.referenceNo}</span></Link> {c.title}</span><StatusPill status={c.status as CaseStatus} /></div>)}
                  <div style={{ marginTop: 8 }}><Typography.Text strong>Release alerts: </Typography.Text>{d.subscription ? <span>{d.subscription.isActive ? "subscribed" : "stopped"} · {d.subscription.topics.length ? d.subscription.topics.join(", ") : "all areas"} · {d.subscription.frequency === "EVERY" ? "every release" : "monthly"}</span> : <span className="muted">not subscribed</span>}</div>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title={`Data given to this number (${d.handedOut.length})`}>
                  {d.handedOut.length === 0 && <span className="muted">Nothing yet</span>}
                  {d.handedOut.slice(0, 30).map((h) => <div key={h.id} style={{ fontSize: 12, marginBottom: 4 }}><span className="muted">{formatDate(h.createdAt)}</span> · {h.title}{h.format ? ` (${h.format})` : ""}{h.topicName ? <span className="muted"> · {h.topicName}</span> : null}</div>)}
                </Card>
              </Col>
            </Row>
          </Space>
        )}
      </Col>
    </Row>
  );
}
