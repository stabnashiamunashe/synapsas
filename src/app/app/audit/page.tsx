"use client";

import { Button, Card, Col, DatePicker, Drawer, Descriptions, Input, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useState } from "react";
import { downloadUrl, formatDate, useApi } from "@/lib/client";

interface Row { id: string; action: string; entityType: string; entityId?: string | null; meta: Record<string, unknown>; ip?: string | null; userAgent?: string | null; createdAt: string; user?: { id: string; name: string; email: string } | null }
interface Page { total: number; page: number; pageSize: number; items: Row[] }

const ACTION_COLOR = (a: string) =>
  a.includes("failed") || a.includes("locked") || a.includes("blocked") || a.includes("reject") ? "red"
  : a.startsWith("auth.") ? "geekblue" : a.includes("approve") || a.includes("created") ? "green" : a.includes("delete") || a.includes("deactivat") || a.includes("revoked") ? "volcano" : "default";

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [entityType, setEntityType] = useState<string | undefined>();
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const qs = new URLSearchParams({
    page: String(page), pageSize: "50",
    ...(action ? { action } : {}), ...(category !== "all" ? { category } : {}), ...(entityType ? { entityType } : {}),
    ...(range ? { from: range[0].startOf("day").toISOString(), to: range[1].endOf("day").toISOString() } : {}),
  });
  const { data, isLoading } = useApi<Page>(`/api/audit?${qs}`);
  // Fixed once per mount so the SWR keys stay stable between renders.
  const [since] = useState(() => ({ day: dayjs().subtract(1, "day").toISOString(), week: dayjs().subtract(7, "day").toISOString() }));
  const { data: authFails } = useApi<Page>(`/api/audit?action=auth.login_failed&pageSize=1&from=${since.day}`);
  const { data: locks } = useApi<Page>(`/api/audit?action=auth.locked&pageSize=1&from=${since.week}`);
  const { data: logins } = useApi<Page>(`/api/audit?action=auth.login&pageSize=1&from=${since.day}`);

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Audit log</Typography.Title>
          <Typography.Text type="secondary">Immutable record of every sign-in, decision and configuration change, with source IP and device.</Typography.Text>
        </div>
        <Button icon={<DownloadOutlined />} onClick={() => downloadUrl(`/api/audit/export?${qs}`)}>Export CSV</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}><Card size="small"><Statistic title="Sign-ins (24h)" value={logins?.total ?? 0} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="Failed sign-ins (24h)" value={authFails?.total ?? 0} styles={{ content: { color: authFails?.total ? "#c53030" : undefined } }} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="Account lockouts (7d)" value={locks?.total ?? 0} styles={{ content: { color: locks?.total ? "#c05621" : undefined } }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Segmented value={category} onChange={(v) => { setCategory(String(v)); setPage(1); }} options={[{ label: "All", value: "all" }, { label: "Security", value: "auth" }, { label: "Requests", value: "request" }, { label: "Administration", value: "admin" }]} />
          <Input.Search placeholder="Action contains, e.g. approve" allowClear style={{ width: 240 }} onSearch={(v) => { setAction(v); setPage(1); }} />
          <Select placeholder="Entity" allowClear style={{ width: 170 }} value={entityType} onChange={(v) => { setEntityType(v); setPage(1); }}
            options={["Request", "WorkflowTemplate", "User", "Organization", "Department", "ApiKey", "Webhook", "Invitation", "Delegation", "AuditLog"].map((e) => ({ value: e, label: e }))} />
          <DatePicker.RangePicker value={range} onChange={(v) => { setRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null); setPage(1); }} />
        </Space>
      </Card>

      <Table<Row> rowKey="id" size="small" loading={isLoading} dataSource={data?.items || []}
        pagination={{ current: page, pageSize: 50, total: data?.total || 0, onChange: setPage, showTotal: (t) => `${t} events` }}
        onRow={(r) => ({ onClick: () => setSelected(r), className: "clickable-row" })}
        columns={[
          { title: "When", dataIndex: "createdAt", width: 165, render: (d) => formatDate(d, true) },
          { title: "Actor", width: 200, render: (_, r) => r.user ? <span>{r.user.name}<div className="muted" style={{ fontSize: 11 }}>{r.user.email}</div></span> : <Tag>system</Tag> },
          { title: "Action", dataIndex: "action", width: 230, render: (a) => <Tag color={ACTION_COLOR(a)} className="mono">{a}</Tag> },
          { title: "Entity", width: 170, render: (_, r) => <span>{r.entityType}{r.entityId ? <span className="muted mono" style={{ fontSize: 11 }}> {r.entityId.slice(0, 8)}</span> : ""}</span> },
          { title: "IP", dataIndex: "ip", width: 120, render: (v) => v ? <span className="mono">{v}</span> : <span className="muted">–</span> },
          { title: "Details", render: (_, r) => <span className="mono" style={{ fontSize: 12 }}>{Object.keys(r.meta || {}).length ? JSON.stringify(r.meta) : ""}</span>, ellipsis: true },
        ]} />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Audit event" size="large">
        {selected && (
          <Descriptions column={1} size="small" bordered items={[
            { key: "w", label: "When", children: formatDate(selected.createdAt, true) },
            { key: "a", label: "Action", children: <Tag color={ACTION_COLOR(selected.action)} className="mono">{selected.action}</Tag> },
            { key: "u", label: "Actor", children: selected.user ? `${selected.user.name} (${selected.user.email})` : "system" },
            { key: "e", label: "Entity", children: `${selected.entityType} ${selected.entityId || ""}` },
            { key: "i", label: "IP address", children: selected.ip || "–" },
            { key: "g", label: "User agent", children: <span style={{ fontSize: 12, wordBreak: "break-all" }}>{selected.userAgent || "–"}</span> },
            { key: "m", label: "Details", children: <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(selected.meta, null, 2)}</pre> },
            { key: "id", label: "Event ID", children: <span className="mono">{selected.id}</span> },
          ]} />
        )}
      </Drawer>
    </div>
  );
}
