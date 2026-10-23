"use client";

import { Alert, App, Button, Card, Col, Descriptions, Form, Input, Row, Space, Statistic, Switch, Table, Tag, Typography } from "antd";
import { SendOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import { api, formatDate, useApi, useMe } from "@/lib/client";

interface Status {
  configured: boolean; phoneNumberId: string | null; tokenSet: boolean; appSecretSet: boolean; verifyTokenSet: boolean; apiVersion: string;
  templates: { caseCreated: string; caseUpdate: string; language: string }; webhookUrl: string;
  last7days: { sent: number; failed: number; conversations: number; cases: number };
  messages: { id: string; direction: string; phone: string; kind: string; body: string; status: string; error?: string | null; createdAt: string }[];
}
type Reply =
  | { type: "text"; text: string }
  | { type: "buttons"; body: string; header?: string; footer?: string; buttons: { id: string; title: string }[] }
  | { type: "list"; body: string; header?: string; button: string; sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[] }
  | { type: "location_request"; body: string }
  | { type: "template"; name: string; bodyParams: string[] };
type Bubble = { from: "user" | "bot"; reply?: Reply; text?: string };

export default function WhatsAppSettingsPage() {
  const { message } = App.useApp();
  const { data: me, mutate: mutateMe } = useMe();
  const { data: st, mutate } = useApi<Status>("/api/whatsapp/status", { refreshInterval: 15000 });
  const [chat, setChat] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const simPhone = "263700000001";
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const send = async (input: Record<string, unknown>, shown: string) => {
    setBusy(true);
    setChat((c) => [...c, { from: "user", text: shown }]);
    try {
      const r = await api<{ replies: Reply[] }>("/api/whatsapp/simulate", { method: "POST", json: { phone: simPhone, name: "Sandbox user", input } });
      setChat((c) => [...c, ...r.replies.map((reply) => ({ from: "bot" as const, reply }))]);
      mutate();
    } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };
  const wa = me?.org.settings.cases?.whatsapp || {};
  const saveWa = async (patch: Record<string, unknown>) => {
    if (!me) return;
    await api("/api/org", { method: "PATCH", json: { settings: { ...me.org.settings, cases: { ...(me.org.settings.cases || {}), whatsapp: { ...wa, ...patch } } } } });
    mutateMe(); message.success("Saved");
  };

  const renderReply = (r: Reply) => {
    if (r.type === "text") return <div style={{ whiteSpace: "pre-wrap" }}>{r.text}</div>;
    if (r.type === "buttons") return (
      <div>{r.header && <b>{r.header}<br /></b>}<div style={{ whiteSpace: "pre-wrap" }}>{r.body}</div>
        <Space wrap style={{ marginTop: 8 }}>{r.buttons.map((b) => <Button key={b.id} size="small" disabled={busy} onClick={() => send({ kind: "button", id: b.id, title: b.title }, b.title)}>{b.title}</Button>)}</Space>
        {r.footer && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{r.footer}</div>}
      </div>
    );
    if (r.type === "list") return (
      <div>{r.header && <b>{r.header}<br /></b>}<div style={{ whiteSpace: "pre-wrap" }}>{r.body}</div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>{r.sections.flatMap((s) => s.rows).map((row) => <Button key={row.id} size="small" disabled={busy} style={{ textAlign: "left", height: "auto", padding: "4px 10px", width: "100%", whiteSpace: "normal", display: "block" }} onClick={() => send({ kind: "list", id: row.id, title: row.title }, row.title)}><b>{row.title}</b>{row.description && <div className="muted" style={{ fontSize: 11, lineHeight: 1.3 }}>{row.description}</div>}</Button>)}</div>
      </div>
    );
    if (r.type === "location_request") return <div>{r.body}<div style={{ marginTop: 8 }}><Button size="small" disabled={busy} onClick={() => send({ kind: "location", latitude: -17.8292, longitude: 31.0522, name: "Kaguvi Building", address: "Harare" }, "📍 Shared location (Harare)")}>Send location</Button></div></div>;
    return <div className="muted">Template {r.name}({r.bodyParams.join(", ")})</div>;
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<span><WhatsAppOutlined style={{ color: "#25D366" }} /> Connection</span>} extra={st ? (st.configured ? <Tag color="green">Configured</Tag> : <Tag>Not configured</Tag>) : null}>
            {st && !st.configured && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="WhatsApp is optional" description="The rest of the system runs normally without it. Set the four environment variables below on the server to switch intake on; outbound messages are skipped (and logged) until then." />}
            <Descriptions size="small" column={1} layout="vertical" styles={{ content: { wordBreak: "break-word" } }} items={[
              { key: "pn", label: "Phone number ID", children: st?.phoneNumberId || <span className="muted">WHATSAPP_PHONE_NUMBER_ID not set</span> },
              { key: "tok", label: "Access token", children: st?.tokenSet ? <Tag color="green">set</Tag> : <Tag style={{ whiteSpace: "normal" }}>WHATSAPP_ACCESS_TOKEN missing</Tag> },
              { key: "sec", label: "App secret (webhook signature)", children: st?.appSecretSet ? <Tag color="green">set</Tag> : <Tag color="orange" style={{ whiteSpace: "normal" }}>WHATSAPP_APP_SECRET missing</Tag> },
              { key: "ver", label: "Verify token", children: st?.verifyTokenSet ? <Tag color="green">set</Tag> : <Tag color="orange" style={{ whiteSpace: "normal" }}>WHATSAPP_VERIFY_TOKEN missing</Tag> },
              { key: "url", label: "Webhook URL (paste into Meta)", children: <Typography.Text copyable className="mono" style={{ wordBreak: "break-all" }}>{st?.webhookUrl}</Typography.Text> },
              { key: "api", label: "Graph API version", children: st?.apiVersion },
              { key: "t1", label: "Template: case received", children: st?.templates.caseCreated || <span className="muted">WHATSAPP_TEMPLATE_CASE_CREATED not set</span> },
              { key: "t2", label: "Template: case update", children: st?.templates.caseUpdate || <span className="muted">WHATSAPP_TEMPLATE_CASE_UPDATE not set</span> },
            ]} />
            <Space style={{ marginTop: 12 }} wrap>
              <Input placeholder="Test number, e.g. 2637…" value={testTo} onChange={(e) => setTestTo(e.target.value)} style={{ width: 200 }} />
              <Button icon={<SendOutlined />} disabled={!st?.configured || !testTo} onClick={async () => { try { await api("/api/whatsapp/status", { method: "POST", json: { to: testTo, mode: "text" } }); message.success("Sent"); mutate(); } catch (e) { message.error((e as Error).message); } }}>Send test buttons</Button>
              <Button disabled={!st?.configured || !testTo} onClick={async () => { try { await api("/api/whatsapp/status", { method: "POST", json: { to: testTo, mode: "template" } }); message.success("Sent"); mutate(); } catch (e) { message.error((e as Error).message); } }}>Send test template</Button>
            </Space>
          </Card>
          <Card title="Behaviour" style={{ marginTop: 16 }}>
            <Form layout="vertical" initialValues={{ greeting: wa.greeting, helpText: wa.helpText }} onFinish={(v) => saveWa(v)}>
              <Space size="large" wrap style={{ marginBottom: 8 }}>
                <span><Switch checked={wa.enabled !== false} onChange={(v) => saveWa({ enabled: v })} /> Accept reports on WhatsApp</span>
                <span><Switch checked={!!wa.notifyAllReporters} onChange={(v) => saveWa({ notifyAllReporters: v })} /> Also message reporters who used the website or phone</span>
              </Space>
              <Form.Item name="greeting" label="Greeting (main menu text)"><Input placeholder="Welcome to ZimStat. How can we help you today?" /></Form.Item>
              <Form.Item name="helpText" label="Help text"><Input.TextArea autoSize={{ minRows: 2 }} placeholder="Shown when the user taps Help" /></Form.Item>
              <Button htmlType="submit">Save texts</Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Sandbox (no Meta account needed)" extra={<Button size="small" onClick={() => setChat([])}>Clear</Button>}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>This runs the real conversation engine for the number {simPhone}. Tap the buttons exactly as a WhatsApp user would; a case is created in the service desk at the end.</Typography.Paragraph>
            <div style={{ background: "#e5ddd5", borderRadius: 8, padding: 12, height: 420, overflowY: "auto", overflowX: "hidden" }}>
              {chat.length === 0 && <div className="muted" style={{ textAlign: "center", marginTop: 160 }}>Say “Hi” to start.</div>}
              {chat.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: b.from === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
                  <div style={{ maxWidth: "85%", minWidth: 0, overflowWrap: "anywhere", background: b.from === "user" ? "#dcf8c6" : "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxShadow: "0 1px 1px rgba(0,0,0,.08)" }}>{b.from === "user" ? b.text : b.reply && renderReply(b.reply)}</div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <Space.Compact style={{ width: "100%", marginTop: 8 }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message (only needed for the description step)" onPressEnter={() => { if (text.trim()) { send({ kind: "text", text: text.trim() }, text.trim()); setText(""); } }} />
              <Button type="primary" loading={busy} onClick={() => { const t = text.trim() || "Hi"; send({ kind: "text", text: t }, t); setText(""); }}>Send</Button>
            </Space.Compact>
          </Card>
        </Col>
      </Row>
      {st && (
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Sent (7 days)" value={st.last7days.sent} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Failed (7 days)" value={st.last7days.failed} styles={{ content: { color: st.last7days.failed ? "#c53030" : undefined } }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Conversations" value={st.last7days.conversations} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Cases via WhatsApp" value={st.last7days.cases} /></Card></Col>
        </Row>
      )}
      <Card title="Message log">
        <Table rowKey="id" size="small" dataSource={st?.messages || []} pagination={{ pageSize: 15 }} columns={[
          { title: "When", dataIndex: "createdAt", width: 150, render: (d) => formatDate(d, true) },
          { title: "", dataIndex: "direction", width: 50, render: (d) => (d === "IN" ? <Tag>in</Tag> : <Tag color="blue">out</Tag>) },
          { title: "Phone", dataIndex: "phone", width: 140, render: (p) => <span className="mono">{String(p).replace(/\d(?=\d{3})/g, "•")}</span> },
          { title: "Message", dataIndex: "body", ellipsis: true, render: (b) => <span style={{ whiteSpace: "pre-wrap" }}>{b}</span> },
          { title: "Status", dataIndex: "status", width: 110, render: (s, r: { error?: string | null }) => <Tag color={s === "failed" ? "red" : s === "simulated" || s === "skipped" ? "default" : "green"} title={r.error || undefined}>{s}</Tag> },
        ]} />
      </Card>
    </Space>
  );
}
