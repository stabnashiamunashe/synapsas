"use client";

import { Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from "antd";
import Link from "next/link";
import { formatDate, timeAgo } from "@/lib/client";
import { StatusPill } from "@/components/cases/CaseBits";
import type { CaseStatus } from "@/lib/caseTypes";

export interface OverviewData {
  conversations: { day: number; week: number };
  messages: { in: number; out: number; failed: number };
  chats: { waiting: number; active: number };
  dataRequests: { pending: number; approved: number; delivered: number; declined: number };
  handedOut: { week: number; byKind: Record<string, number>; byTopic: { topic: string; name: string; count: number }[] };
  recentCases: { id: string; referenceNo: string; title: string; status: string; createdAt: string; reporterName: string }[];
  subscribers: number;
}

const KIND_LABELS: Record<string, string> = { indicator: "Headline figures viewed", dataset: "Portal datasets sent", link: "Portal links sent", export: "Excel/PDF tables sent", document: "Publications sent", request: "Data requests lodged" };

/** Where a WhatsApp case is handled: data requests and live chats on this desk, everything else on the cases board. */
export const caseHref = (c: { id: string; referenceNo: string; title: string }) =>
  c.referenceNo.startsWith("DR-") ? `/app/chatbot?tab=requests&open=${c.id}` : c.title.startsWith("Live chat") ? `/app/chatbot?tab=chats&open=${c.id}` : `/app/cases?open=${c.id}`;

export function Overview({ data, onGo }: { data?: OverviewData; onGo: (tab: string) => void }) {
  const d = data;
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small" className="stat-card" hoverable onClick={() => onGo("chats")}><Statistic title="Live chats waiting" value={d?.chats.waiting ?? "–"} styles={{ content: { color: d?.chats.waiting ? "#c53030" : undefined } }} /><div className="muted" style={{ fontSize: 12 }}>{d ? `${d.chats.active} being answered` : ""}</div></Card></Col>
        <Col xs={12} md={6}><Card size="small" className="stat-card" hoverable onClick={() => onGo("requests")}><Statistic title="Data requests pending" value={d?.dataRequests.pending ?? "–"} /><div className="muted" style={{ fontSize: 12 }}>{d ? `${d.dataRequests.approved} approved · ${d.dataRequests.delivered} delivered · ${d.dataRequests.declined} declined` : ""}</div></Card></Col>
        <Col xs={12} md={6}><Card size="small" className="stat-card" hoverable onClick={() => onGo("conversations")}><Statistic title="Conversations (7 days)" value={d?.conversations.week ?? "–"} /><div className="muted" style={{ fontSize: 12 }}>{d ? `${d.conversations.day} in the last 24 hours · ${d.subscribers} alert subscribers` : ""}</div></Card></Col>
        <Col xs={12} md={6}><Card size="small" className="stat-card" hoverable onClick={() => onGo("log")}><Statistic title="Data handed out (7 days)" value={d?.handedOut.week ?? "–"} /><div className="muted" style={{ fontSize: 12 }}>{d ? `${d.messages.in} messages in · ${d.messages.out} out${d.messages.failed ? ` · ${d.messages.failed} failed` : ""}` : ""}</div></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="What the bot handed out this week" size="small">
            {d ? Object.entries(d.handedOut.byKind).map(([k, n]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}><span>{KIND_LABELS[k] || k}</span><b>{n}</b></div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />}
            {d && d.handedOut.byTopic.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Most asked-for topics</div>
                <Space wrap>{d.handedOut.byTopic.map((x) => <Tag key={x.topic}>{x.name} · {x.count}</Tag>)}</Space>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="Latest WhatsApp cases" size="small" extra={<Link href="/app/cases">All cases →</Link>}>
            {d && d.recentCases.length ? d.recentCases.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ minWidth: 0 }}>
                  <Link href={caseHref(c)}><span className="mono">{c.referenceNo}</span></Link> <span style={{ marginLeft: 6 }}>{c.title}</span>
                  <div className="muted" style={{ fontSize: 12 }}>{c.reporterName} · <span title={formatDate(c.createdAt, true)}>{timeAgo(c.createdAt)}</span></div>
                </div>
                <StatusPill status={c.status as CaseStatus} />
              </div>
            )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No WhatsApp cases yet" />}
          </Card>
        </Col>
      </Row>
      <Card size="small">
        <Space wrap>
          <Typography.Text type="secondary">Content and behaviour of the bot live under settings:</Typography.Text>
          <Link href="/app/settings/chatbot"><Button size="small">Chatbot content (figures, releases, files, routing)</Button></Link>
          <Link href="/app/settings/whatsapp"><Button size="small">WhatsApp channel (connection, sandbox, message log)</Button></Link>
        </Space>
      </Card>
    </Space>
  );
}
