"use client";

import { App, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Row, Select, Skeleton, Space, Table, Tag, Timeline, Typography } from "antd";
import { DollarOutlined, ExclamationCircleOutlined, FileSearchOutlined, HourglassOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { api, formatDate, formatMoney, useApi } from "@/lib/client";

interface Clearance { id: string; kind: string; amount: number; note?: string | null; createdAt: string; createdBy?: { name: string } | null; requestId?: string | null }
interface Adv { id: string; referenceNo: string; amount: number; clearedAmount: number; outstanding: number; status: string; disbursedAt: string; travelEndsAt?: string | null; dueAt: string; clearedAt?: string | null; overdue: boolean; daysOverdue: number; officer: { id: string; name: string; department?: { name: string } | null }; request: { id: string; title: string; project?: { code: string } | null }; clearances: Clearance[] }
interface Resp { items: Adv[]; summary: { openCount: number; outstanding: number; overdueCount: number; overdueAmount: number }; canClear: boolean }

const STATUS: Record<string, { label: string; color: string }> = { OPEN: { label: "Open", color: "gold" }, PARTIALLY_CLEARED: { label: "Partly cleared", color: "blue" }, CLEARED: { label: "Cleared", color: "green" }, RECOVERED: { label: "Recovered from salary", color: "purple" }, WRITTEN_OFF: { label: "Written off", color: "default" } };
const KIND: Record<string, string> = { CLAIM: "Claim form", CASH_REFUND: "Cash refund", SALARY_RECOVERY: "Salary recovery", WRITE_OFF: "Write-off" };

export default function AdvancesPage() {
  const { message } = App.useApp();
  const [filter, setFilter] = useState<"open" | "overdue" | "all">("open");
  const url = filter === "overdue" ? "/api/advances?overdue=1" : filter === "open" ? "/api/advances?status=OPEN,PARTIALLY_CLEARED" : "/api/advances";
  const { data, isLoading, mutate } = useApi<Resp>(url);
  const [clearing, setClearing] = useState<Adv | null>(null);
  const [viewing, setViewing] = useState<Adv | null>(null);
  const [form] = Form.useForm();

  const submit = async () => {
    const v = await form.validateFields();
    try { await api(`/api/advances/${clearing!.id}`, { method: "POST", json: v }); message.success("Recorded"); setClearing(null); mutate(); }
    catch (e) { message.error((e as Error).message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Advances ledger</Typography.Title>
          <div className="muted">Every T&S advance is opened on approval and must be cleared with a claim form and receipts within 10 days of return. Finance records refunds, salary recoveries and write-offs here.</div>
        </div>
        <Select value={filter} onChange={setFilter} style={{ width: 200 }} options={[{ value: "open", label: "Open accounts" }, { value: "overdue", label: "Overdue only" }, { value: "all", label: "All, including cleared" }]} />
      </div>
      {isLoading || !data ? <Skeleton active /> : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}><StatCard tone="blue" icon={<HourglassOutlined />} value={data.summary.openCount} label="Open advances" /></Col>
            <Col xs={12} md={6}><StatCard tone="purple" icon={<DollarOutlined />} value={formatMoney(data.summary.outstanding)} label="Outstanding" /></Col>
            <Col xs={12} md={6}><StatCard tone="orange" icon={<ExclamationCircleOutlined />} value={data.summary.overdueCount} label="Overdue" hint={data.summary.overdueCount ? <span style={{ color: "#b45309" }}>{formatMoney(data.summary.overdueAmount)} past the 10-day limit</span> : <span className="muted">All within time</span>} /></Col>
            <Col xs={12} md={6}><StatCard tone="green" icon={<FileSearchOutlined />} value={data.items.filter((a) => a.status === "CLEARED").length} label="Cleared (in view)" /></Col>
          </Row>
          <Card>
            {data.items.length === 0 ? <Empty description="No advances in this view" /> : (
              <Table<Adv> rowKey="id" dataSource={data.items} size="small" pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 1250 }} columns={[
                { title: "Reference", width: 150, render: (_, a) => <Link href={`/app/requests/${a.request.id}`} className="mono">{a.referenceNo}</Link> },
                { title: "Officer", render: (_, a) => <span>{a.officer.name}<div className="muted" style={{ fontSize: 12 }}>{a.officer.department?.name}</div></span> },
                { title: "Purpose", ellipsis: true, render: (_, a) => <span>{a.request.title}{a.request.project && <Tag style={{ marginLeft: 6 }}>{a.request.project.code}</Tag>}</span> },
                { title: "Advance", width: 110, align: "right", render: (_, a) => formatMoney(a.amount) },
                { title: "Cleared", width: 110, align: "right", render: (_, a) => formatMoney(a.clearedAmount) },
                { title: "Outstanding", width: 120, align: "right", render: (_, a) => <b style={{ color: a.outstanding > 0 ? "#b45309" : undefined }}>{formatMoney(a.outstanding)}</b> },
                { title: "Clear by", width: 170, render: (_, a) => a.overdue ? <Tag color="red">{formatDate(a.dueAt)} · {a.daysOverdue}d late</Tag> : <span>{formatDate(a.dueAt)}</span> },
                { title: "Status", width: 150, render: (_, a) => <Tag color={STATUS[a.status]?.color}>{STATUS[a.status]?.label || a.status}</Tag> },
                { title: "", width: 130, render: (_, a) => <Space><a onClick={() => setViewing(a)}>History</a>{data.canClear && a.outstanding > 0 && <a onClick={() => { setClearing(a); form.setFieldsValue({ kind: "CASH_REFUND", amount: a.outstanding, note: "" }); }}>Clear</a>}</Space> },
              ]} />
            )}
          </Card>
        </>
      )}

      <Modal open={!!clearing} title={clearing ? `Clear ${clearing.referenceNo}` : ""} onCancel={() => setClearing(null)} onOk={submit} okText="Record" destroyOnHidden>
        {clearing && <Typography.Paragraph type="secondary">{clearing.officer.name} · outstanding {formatMoney(clearing.outstanding)}. Claims are matched automatically when a T&S claim naming this reference is approved; use this for anything else.</Typography.Paragraph>}
        <Form form={form} layout="vertical">
          <Form.Item name="kind" label="How is it being cleared?" rules={[{ required: true }]}><Select options={[{ value: "CASH_REFUND", label: "Cash refund to the cashier" }, { value: "SALARY_RECOVERY", label: "Recovery from salary" }, { value: "CLAIM", label: "Manual claim match (paper claim)" }, { value: "WRITE_OFF", label: "Write-off (requires Director General's approval)" }]} /></Form.Item>
          <Form.Item name="amount" label="Amount (USD)" rules={[{ required: true }]}><InputNumber min={0.01} max={clearing?.outstanding} step={0.01} style={{ width: 200 }} /></Form.Item>
          <Form.Item name="note" label="Note / receipt reference"><Input placeholder="e.g. Receipt 0451, or payroll run Nov" /></Form.Item>
        </Form>
      </Modal>

      <Modal open={!!viewing} title={viewing ? `${viewing.referenceNo} · ${viewing.officer.name}` : ""} footer={<Button onClick={() => setViewing(null)}>Close</Button>} onCancel={() => setViewing(null)} destroyOnHidden>
        {viewing && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={STATUS[viewing.status]?.color}>{STATUS[viewing.status]?.label}</Tag>
              <span>Disbursed {formatDate(viewing.disbursedAt)}</span>
              {viewing.travelEndsAt && <span>· travel ended {formatDate(viewing.travelEndsAt)}</span>}
              <span>· clear by {formatDate(viewing.dueAt)}</span>
            </Space>
            <Timeline items={[
              { color: "blue", content: <span><b>{formatMoney(viewing.amount)}</b> advanced · {formatDate(viewing.disbursedAt)}</span> },
              ...viewing.clearances.map((c) => ({ color: "green", content: <span><b>{formatMoney(c.amount)}</b> {KIND[c.kind] || c.kind}{c.note ? ` · ${c.note}` : ""}{c.requestId ? <> · <Link href={`/app/requests/${c.requestId}`}>open claim</Link></> : null}<div className="muted" style={{ fontSize: 12 }}>{formatDate(c.createdAt, true)}{c.createdBy ? ` · ${c.createdBy.name}` : " · automatic"}</div></span> })),
              ...(viewing.outstanding > 0 ? [{ color: viewing.overdue ? "red" : "gray", content: <span>Outstanding <b>{formatMoney(viewing.outstanding)}</b>{viewing.overdue ? ` · ${viewing.daysOverdue} days overdue` : ""}</span> }] : []),
            ]} />
          </>
        )}
      </Modal>
    </div>
  );
}
