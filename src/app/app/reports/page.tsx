"use client";

import { Card, Col, Progress, Row, Segmented, Skeleton, Statistic, Table, Typography } from "antd";
import { useState } from "react";
import { useApi } from "@/lib/client";

interface Report {
  days: number;
  totals: { created: number; approved: number; rejected: number; pending: number; avgTurnaroundHours: number | null };
  byMonth: { month: string; created: number; approved: number; rejected: number }[];
  byStatus: { status: string; count: number }[];
  perTemplate: { templateId: string; name: string; color?: string | null; total: number; approved: number; rejected: number; pending: number; avgHours: number | null }[];
  slowestLevels: { level: string; template: string; count: number; avgHours: number }[];
  approvers: { userId: string; name: string; actions: number; approved: number; rejected: number; avgHours: number }[];
}

export default function ReportsPage() {
  const [days, setDays] = useState(90);
  const { data } = useApi<Report>(`/api/reports?days=${days}`);
  if (!data) return <Skeleton active />;
  const maxMonth = Math.max(1, ...data.byMonth.map((m) => m.created));

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Reports</Typography.Title>
          <Typography.Text type="secondary">Throughput, turnaround and bottlenecks.</Typography.Text>
        </div>
        <Segmented value={days} onChange={(v) => setDays(Number(v))} options={[{ label: "30 days", value: 30 }, { label: "90 days", value: 90 }, { label: "180 days", value: 180 }, { label: "1 year", value: 365 }]} />
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><Card><Statistic title="Created" value={data.totals.created} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Approved" value={data.totals.approved} styles={{ content: { color: "#52c41a" } }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Rejected" value={data.totals.rejected} styles={{ content: { color: "#ff4d4f" } }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Avg. turnaround" value={data.totals.avgTurnaroundHours ?? "–"} suffix={data.totals.avgTurnaroundHours != null ? "h" : ""} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Volume by month">
            {data.byMonth.length === 0 ? <Typography.Text type="secondary">No data in this window.</Typography.Text> : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 180 }}>
                {data.byMonth.map((m) => (
                  <div key={m.month} style={{ flex: 1, textAlign: "center" }}>
                    <div title={`${m.created} created, ${m.approved} approved, ${m.rejected} rejected`} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 140 }}>
                      <div style={{ background: "var(--brand-color)", height: `${(m.created / maxMonth) * 100}%`, borderRadius: "4px 4px 0 0", minHeight: 2 }} />
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{m.month.slice(2)}</div>
                    <div style={{ fontSize: 12 }}>{m.created}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="By workflow">
            <Table size="small" pagination={false} rowKey="templateId" dataSource={data.perTemplate}
              columns={[
                { title: "Workflow", dataIndex: "name" },
                { title: "Total", dataIndex: "total", width: 70 },
                { title: "Approval rate", width: 150, render: (_, t) => <Progress percent={t.total ? Math.round((t.approved / t.total) * 100) : 0} size="small" strokeColor={t.color || undefined} /> },
                { title: "Avg h", dataIndex: "avgHours", width: 80, render: (v) => v ?? "–" },
              ]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Slowest levels (avg. hours to decision)">
            <Table size="small" pagination={false} rowKey={(r) => `${r.template}-${r.level}`} dataSource={data.slowestLevels}
              columns={[{ title: "Workflow", dataIndex: "template" }, { title: "Level", dataIndex: "level" }, { title: "Decisions", dataIndex: "count", width: 90 }, { title: "Avg h", dataIndex: "avgHours", width: 80 }]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Approver activity">
            <Table size="small" pagination={false} rowKey="userId" dataSource={data.approvers}
              columns={[{ title: "Approver", dataIndex: "name" }, { title: "Decisions", dataIndex: "actions", width: 90 }, { title: "Approved", dataIndex: "approved", width: 90 }, { title: "Rejected", dataIndex: "rejected", width: 90 }, { title: "Avg h", dataIndex: "avgHours", width: 80 }]} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
