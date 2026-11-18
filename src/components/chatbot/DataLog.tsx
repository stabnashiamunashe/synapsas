"use client";

import { Button, Card, Col, DatePicker, Input, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { downloadUrl, formatDate, timeAgo, useApi } from "@/lib/client";
import { STAT_GROUPS, STAT_TOPICS } from "@/lib/whatsapp/i18n";

interface Row { id: string; phone: string; kind: string; kindLabel: string; topic: string | null; topicName: string | null; title: string; ref: string | null; format: string | null; caseId: string | null; createdAt: string }
interface Resp { items: Row[]; total: number; page: number; pageSize: number; totalPages: number; summary: { byKind: { kind: string; label: string; count: number }[]; byTopic: { topic: string; name: string; count: number }[]; top: { kind: string; label: string; title: string; count: number }[] } }

const KIND_COLOR: Record<string, string> = { indicator: "blue", dataset: "geekblue", link: "cyan", export: "green", document: "purple", request: "gold" };
const topicOptions = STAT_GROUPS.map((g) => ({ label: g.en, title: g.en, options: [{ value: g.key, label: `${g.en} (area)` }, ...STAT_TOPICS.filter((t) => t.group === g.key).map((t) => ({ value: t.key, label: t.en }))] }));

/** The log of what the bot handed out or was asked for, with totals by kind and topic and the most requested items. */
export function DataLog() {
  const [kind, setKind] = useState<string | undefined>();
  const [topic, setTopic] = useState<string | undefined>();
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (topic) p.set("topic", topic);
    if (range?.[0]) p.set("from", range[0].format("YYYY-MM-DD"));
    if (range?.[1]) p.set("to", range[1].format("YYYY-MM-DD"));
    if (q) p.set("q", q);
    p.set("page", String(page)); p.set("pageSize", "50");
    return p.toString();
  }, [kind, topic, range, q, page]);
  const { data, isLoading } = useApi<Resp>(`/api/chatbot/data-log?${qs}`, { refreshInterval: 30000 });

  return (
    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
      <Card size="small">
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            <Select allowClear placeholder="Kind" style={{ width: 190 }} value={kind} onChange={(v) => { setKind(v); setPage(1); }} options={(data?.summary.byKind || []).map((k) => ({ value: k.kind, label: `${k.label} (${k.count})` }))} />
            <Select allowClear showSearch optionFilterProp="label" placeholder="Area or topic" style={{ width: 240 }} value={topic} onChange={(v) => { setTopic(v); setPage(1); }} options={topicOptions} />
            <DatePicker.RangePicker value={range} onChange={(v) => { setRange(v); setPage(1); }} />
            <Input.Search allowClear placeholder="Item or reference" style={{ width: 220 }} onSearch={(v) => { setQ(v); setPage(1); }} />
          </Space>
          <Button icon={<DownloadOutlined />} onClick={() => downloadUrl(`/api/chatbot/data-log?${qs}&format=csv`)}>CSV</Button>
        </Space>
      </Card>
      <Row gutter={[12, 12]}>
        {(data?.summary.byKind || []).map((k) => (
          <Col xs={12} md={4} key={k.kind}><Card size="small" hoverable onClick={() => { setKind(kind === k.kind ? undefined : k.kind); setPage(1); }} style={{ borderColor: kind === k.kind ? "var(--brand-color)" : undefined }}><Statistic title={k.label} value={k.count} /></Card></Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Table<Row> rowKey="id" size="small" loading={isLoading && !data} dataSource={data?.items || []} scroll={{ x: 900 }}
            pagination={{ current: data?.page || 1, pageSize: 50, total: data?.total || 0, onChange: setPage, showSizeChanger: false, showTotal: (n) => `${n} entries` }}
            columns={[
              { title: "When", dataIndex: "createdAt", width: 120, render: (v) => <Tooltip title={formatDate(v, true)}>{timeAgo(v)}</Tooltip> },
              { title: "Kind", dataIndex: "kind", width: 150, render: (k, r) => <Tag color={KIND_COLOR[k]}>{r.kindLabel}</Tag> },
              { title: "Item", dataIndex: "title", ellipsis: true, render: (v, r) => <span>{v}{r.format ? <span className="muted"> · {r.format}</span> : null}{r.ref && r.kind === "request" ? <span className="mono muted"> · {r.ref}</span> : null}</span> },
              { title: "Area / topic", dataIndex: "topicName", width: 180, render: (v) => v || <span className="muted">–</span> },
              { title: "Number", dataIndex: "phone", width: 140, render: (v) => <span className="mono">{v}</span> },
            ]} />
        </Col>
        <Col xs={24} lg={8}>
          <Card size="small" title="Most requested" style={{ marginBottom: 12 }}>
            {(data?.summary.top || []).length === 0 && <span className="muted">Nothing in this range</span>}
            {(data?.summary.top || []).map((x, i) => <div key={`${x.kind}-${x.title}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 6 }}><span style={{ minWidth: 0 }}><span className="muted">{i + 1}.</span> {x.title} <Tag color={KIND_COLOR[x.kind]} style={{ fontSize: 10, lineHeight: "16px" }}>{x.label}</Tag></span><b>{x.count}</b></div>)}
          </Card>
          <Card size="small" title="By area and topic">
            {(data?.summary.byTopic || []).length === 0 && <span className="muted">Nothing in this range</span>}
            {(data?.summary.byTopic || []).map((x) => <div key={x.topic} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, cursor: "pointer" }} onClick={() => { setTopic(x.topic); setPage(1); }}><span>{x.name}</span><b>{x.count}</b></div>)}
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>Every headline figure viewed, portal dataset or link sent, Excel/PDF table or publication sent, and data request lodged on WhatsApp. Numbers are masked.</Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
