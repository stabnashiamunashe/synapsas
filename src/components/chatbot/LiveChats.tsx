"use client";

import { App, Avatar, Button, Card, Col, Empty, Input, Popconfirm, Row, Segmented, Space, Tag, Tooltip, Typography } from "antd";
import { PaperClipOutlined, SendOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, formatDate, timeAgo, useApi, useMe } from "@/lib/client";
import { StatusPill } from "@/components/cases/CaseBits";
import type { CaseStatus } from "@/lib/caseTypes";

interface ChatRow { id: string; referenceNo: string; title: string; status: string; reporterName: string; phone: string | null; assignee: { id: string; name: string; avatarUrl?: string | null } | null; category: { name: string } | null; createdAt: string; lastActivityAt: string; messages: number; last: { body: string; fromOfficer: boolean; authorName: string; createdAt: string } | null; waiting: boolean; mine: boolean }
interface ChatDetail {
  id: string; referenceNo: string; title: string; description: string; status: string; reporterName: string; phone: string | null; assignee: { id: string; name: string } | null; category: { name: string } | null; department: { name: string } | null;
  createdAt: string; lastActivityAt: string; resolvedAt: string | null; ended: boolean; mine: boolean; personInChat: boolean; sessionId: string | null;
  messages: { id: string; body: string; isInternal: boolean; fromOfficer: boolean; authorName: string; createdAt: string }[];
  attachments: { id: string; fileName: string; size: number; createdAt: string }[];
  events: { id: string; toStatus: string; changedByName: string; reason: string | null; createdAt: string }[];
}

/** Live chats: the list on the left, the conversation with the person on the right. Replies are delivered to WhatsApp as they are sent. */
export function LiveChats({ onChanged }: { onChanged: () => void }) {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const [view, setView] = useState<"open" | "ended">("open");
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const { data: list, mutate: mutateList, isLoading } = useApi<ChatRow[]>(`/api/chatbot/chats?status=${view}`, { refreshInterval: 10000 });
  // nothing chosen yet: show the first open chat
  const selected = open || (view === "open" && list?.[0]?.id) || null;
  const { data: c, mutate } = useApi<ChatDetail>(selected ? `/api/chatbot/chats/${selected}` : null, { refreshInterval: 5000 });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [c?.messages.length, selected]);
  const select = useCallback((id: string) => { setOpen(id); router.replace(`/app/chatbot?tab=chats&open=${id}`); }, [router]);
  const act = async (action: "accept" | "reply" | "end", body?: string) => {
    if (!c) return;
    setBusy(true);
    try {
      const r = await api<{ sent: boolean }>(`/api/chatbot/chats/${c.id}`, { method: "POST", json: { action, text: body } });
      if (action === "reply") { setText(""); if (!r.sent) message.warning("Saved on the case, but WhatsApp did not accept the message (see the message log)."); }
      if (action === "end") message.success("Chat ended; the person was told and is back at the menu.");
      if (action === "accept") message.success("You have the chat.");
      await Promise.all([mutate(), mutateList()]); onChanged();
    } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };

  const bubble = (m: ChatDetail["messages"][number]) => {
    if (m.isInternal) return <div key={m.id} className="muted" style={{ textAlign: "center", fontSize: 12, margin: "6px 0" }}>{m.body} · {timeAgo(m.createdAt)}</div>;
    const mine = m.fromOfficer;
    return (
      <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
        <div style={{ maxWidth: "78%", background: mine ? "#dcf8c6" : "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxShadow: "0 1px 1px rgba(0,0,0,.08)", overflowWrap: "anywhere" }}>
          <div style={{ fontSize: 11, color: "#667085", marginBottom: 2 }}>{mine ? m.authorName : c?.reporterName || "Person"}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
          <div style={{ fontSize: 10, color: "#98a2b3", textAlign: "right", marginTop: 2 }} title={formatDate(m.createdAt, true)}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
    );
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card size="small" title={<Segmented size="small" value={view} onChange={(v) => setView(v as "open" | "ended")} options={[{ value: "open", label: "Open" }, { value: "ended", label: "Ended" }]} />} styles={{ body: { padding: 0, maxHeight: 640, overflowY: "auto" } }} loading={isLoading && !list}>
          {list && list.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={view === "open" ? "No one is waiting. Live chats start when a person chooses “Talk to an officer” on WhatsApp." : "No ended chats yet"} style={{ padding: 24 }} />}
          {(list || []).map((r) => (
            <div key={r.id} onClick={() => select(r.id)} style={{ padding: "10px 12px", borderBottom: "1px solid #eef0f3", cursor: "pointer", background: selected === r.id ? "#eef4ff" : r.waiting ? "#fffbe6" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reporterName}</b>
                <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(r.lastActivityAt)}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.last ? `${r.last.fromOfficer ? `${r.last.authorName}: ` : ""}${r.last.body}` : r.title}</div>
              <Space size={4} wrap style={{ marginTop: 4 }}>
                <span className="mono muted" style={{ fontSize: 11 }}>{r.referenceNo}</span>
                {r.waiting && <Tag color="gold" style={{ marginInlineEnd: 0 }}>waiting</Tag>}
                {r.mine && <Tag color="blue" style={{ marginInlineEnd: 0 }}>mine</Tag>}
                {!r.mine && r.assignee && <Tag style={{ marginInlineEnd: 0 }}>{r.assignee.name}</Tag>}
                {r.category && <Tag style={{ marginInlineEnd: 0 }}>{r.category.name}</Tag>}
              </Space>
            </div>
          ))}
        </Card>
      </Col>
      <Col xs={24} lg={15}>
        {!c ? (
          <Card size="small" style={{ minHeight: 400 }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick a chat on the left" style={{ marginTop: 120 }} /></Card>
        ) : (
          <Card size="small"
            title={<Space wrap><b>{c.reporterName}</b><span className="mono muted">{c.phone}</span><span className="mono muted">{c.referenceNo}</span><StatusPill status={c.status as CaseStatus} />{c.personInChat ? <Tag color="green">in the chat now</Tag> : !c.ended ? <Tooltip title="They went back to the menu; your replies still reach them on WhatsApp inside the 24-hour window."><Tag>left the chat</Tag></Tooltip> : null}</Space>}
            extra={<Space>
              {!c.ended && !c.mine && <Button size="small" type="primary" loading={busy} onClick={() => act("accept")}>{c.assignee ? "Take over" : "Accept chat"}</Button>}
              {!c.ended && <Popconfirm title="End this chat? The person is told and returns to the menu." onConfirm={() => act("end", text.trim() || undefined)}><Button size="small" danger>End chat</Button></Popconfirm>}
              <a href={`/app/cases?open=${c.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Case ↗</a>
            </Space>}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Started {formatDate(c.createdAt, true)}{c.category ? ` · ${c.category.name}` : ""}{c.department ? ` · ${c.department.name}` : ""}{c.assignee ? ` · answered by ${c.assignee.name}` : " · nobody has taken this chat yet"}{c.ended && c.resolvedAt ? ` · ended ${formatDate(c.resolvedAt, true)}` : ""}
            </div>
            <div style={{ background: "#e5ddd5", borderRadius: 8, padding: 12, height: 440, overflowY: "auto" }}>
              <div className="muted" style={{ fontSize: 12, background: "#fff6d6", borderRadius: 6, padding: "6px 10px", marginBottom: 10, whiteSpace: "pre-wrap" }}>{c.description.split("\n\nConversation so far:")[1] ? `Before asking for an officer:${c.description.split("\n\nConversation so far:")[1]}` : c.description}</div>
              {c.messages.map(bubble)}
              {c.attachments.length > 0 && <div style={{ marginTop: 8 }}>{c.attachments.map((a) => <div key={a.id}><PaperClipOutlined /> <a href={`/api/case-attachments/${a.id}`}>{a.fileName}</a> <span className="muted" style={{ fontSize: 11 }}>{Math.max(1, Math.round(a.size / 1024))} KB</span></div>)}</div>}
              <div ref={endRef} />
            </div>
            {c.ended ? (
              <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>This chat has ended. If the person writes again, a new chat appears in the list.</Typography.Text>
            ) : (
              <div style={{ marginTop: 8 }}>
                <Input.TextArea value={text} onChange={(e) => setText(e.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} placeholder={`Reply as ${me?.user.name || "officer"} (Enter to send, Shift+Enter for a new line)`} onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); if (text.trim()) act("reply", text.trim()); } }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span className="muted" style={{ fontSize: 12 }}>Delivered to WhatsApp at once and kept on case {c.referenceNo}.</span>
                  <Button type="primary" icon={<SendOutlined />} loading={busy} disabled={!text.trim()} onClick={() => act("reply", text.trim())}>Send</Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </Col>
    </Row>
  );
}

export const chatAvatar = (name: string, url?: string | null) => <Avatar size={22} src={url || undefined}>{name.slice(0, 1)}</Avatar>;
