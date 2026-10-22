"use client";

import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Progress, Row, Segmented, Select, Skeleton, Space, Table, Typography } from "antd";
import { FolderOpenOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatMoney, useApi, useMe } from "@/lib/client";
import { StatCard } from "@/components/StatCard";
import { StatusTag } from "@/components/StatusTag";
import { ROLE_RANK } from "@/lib/roles";

export interface ProjectRow {
  id: string; code: string; name: string; description?: string | null; status: string; budgetAmount: number | null; currency: string;
  ownerUserId?: string | null; owner?: { id: string; name: string } | null; startsAt?: string | null; endsAt?: string | null; _count: { requests: number };
  summary: { requests: number; approved: number; pending: number; draft: number; rejected: number; committed: number; budget: number | null; remaining: number | null; remainingAfterPending: number | null; utilisation: number | null; byStatus: Record<string, { count: number; amount: number }> };
}

export default function ProjectsPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { data: me } = useMe();
  const [scope, setScope] = useState<"open" | "all">("open");
  const { data, isLoading, mutate } = useApi<ProjectRow[]>(`/api/projects${scope === "all" ? "?all=1" : ""}`);
  const { data: users } = useApi<{ id: string; name: string }[]>("/api/users");
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const canManage = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const currency = me?.org.settings.currency || "USD";

  const totals = (data || []).reduce((acc, p) => ({ budget: acc.budget + (p.summary.budget || 0), approved: acc.approved + p.summary.approved, pending: acc.pending + p.summary.pending, count: acc.count + 1 }), { budget: 0, approved: 0, pending: 0, count: 0 });

  const create = async () => {
    const v = await form.validateFields();
    try {
      const p = await api<ProjectRow>("/api/projects", { method: "POST", json: { ...v, startsAt: v.dates?.[0]?.toISOString(), endsAt: v.dates?.[1]?.toISOString(), dates: undefined } });
      message.success("Project created");
      setOpen(false); form.resetFields(); mutate();
      router.push(`/app/projects/${p.id}`);
    } catch (e) { message.error((e as Error).message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Projects</Typography.Title>
          <Typography.Text type="secondary">Group requests under a project to track approved and pending spend against its budget.</Typography.Text>
        </div>
        <Space>
          <Segmented value={scope} onChange={(v) => setScope(v as "open" | "all")} options={[{ label: "Open", value: "open" }, { label: "All", value: "all" }]} />
          {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ currency, status: "ACTIVE" }); setOpen(true); }}>New project</Button>}
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><StatCard tone="blue" icon={<FolderOpenOutlined />} value={totals.count} label={scope === "open" ? "Open projects" : "Projects"} /></Col>
        <Col xs={12} md={6}><StatCard tone="grey" icon={<span>Σ</span>} value={formatMoney(totals.budget, currency)} label="Total budget" /></Col>
        <Col xs={12} md={6}><StatCard tone="green" icon={<span>✓</span>} value={formatMoney(totals.approved, currency)} label="Approved spend" hint={<span className="muted">{totals.budget ? `${Math.round((totals.approved / totals.budget) * 100)}% of budget` : "No budgets set"}</span>} /></Col>
        <Col xs={12} md={6}><StatCard tone="orange" icon={<span>…</span>} value={formatMoney(totals.pending, currency)} label="Awaiting approval" /></Col>
      </Row>

      {isLoading ? <Skeleton active /> : (
        <Table<ProjectRow> rowKey="id" dataSource={data || []} pagination={false} onRow={(p) => ({ onClick: () => router.push(`/app/projects/${p.id}`), className: "clickable-row" })} locale={{ emptyText: "No projects yet" }}
          columns={[
            { title: "Project", render: (_, p) => <span><span className="mono muted" style={{ marginRight: 8 }}>{p.code}</span><b>{p.name}</b>{p.owner && <div className="muted" style={{ fontSize: 12 }}>Owner: {p.owner.name}</div>}</span> },
            { title: "Status", dataIndex: "status", width: 120, render: (s) => <StatusTag status={s} /> },
            { title: "Requests", width: 90, render: (_, p) => p.summary.requests },
            { title: "Approved spend", width: 150, align: "right", render: (_, p) => <span className="mono">{formatMoney(p.summary.approved, p.currency)}</span> },
            { title: "Pending", width: 130, align: "right", render: (_, p) => <span className="mono muted">{formatMoney(p.summary.pending, p.currency)}</span> },
            { title: "Budget", width: 150, align: "right", render: (_, p) => p.summary.budget == null ? <span className="muted">–</span> : <span className="mono">{formatMoney(p.summary.budget, p.currency)}</span> },
            { title: "Utilisation", width: 180, render: (_, p) => p.summary.utilisation == null ? <span className="muted">no budget</span> : <Progress percent={Math.round(p.summary.utilisation * 100)} size="small" status={p.summary.utilisation > 1 ? "exception" : p.summary.utilisation > 0.85 ? "active" : "normal"} strokeColor={p.summary.utilisation > 1 ? "#e5484d" : p.summary.utilisation > 0.85 ? "#f59e0b" : undefined} /> },
            { title: "Remaining", width: 140, align: "right", render: (_, p) => p.summary.remaining == null ? <span className="muted">–</span> : <span className="mono" style={{ color: p.summary.remaining < 0 ? "#b42318" : undefined }}>{formatMoney(p.summary.remaining, p.currency)}</span> },
          ]} />
      )}

      <Modal open={open} onCancel={() => setOpen(false)} onOk={create} title="New project" okText="Create project" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={8}><Form.Item name="code" label="Code" rules={[{ required: true, pattern: /^[A-Z0-9][A-Z0-9-]*$/, message: "Uppercase letters, numbers, dashes" }]} normalize={(v: string) => (v || "").toUpperCase()}><Input placeholder="HQ-FITOUT" /></Form.Item></Col>
            <Col span={16}><Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}><Input placeholder="Head office fit-out" /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="budgetAmount" label="Budget"><InputNumber style={{ width: "100%" }} min={0} precision={2} prefix={currency} /></Form.Item></Col>
            <Col span={12}><Form.Item name="currency" label="Currency"><Select options={["USD", "ZWG", "ZAR", "EUR", "GBP", "KES", "NGN", "BWP", "ZMW", "MZN"].map((c) => ({ value: c, label: c }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="ownerUserId" label="Project owner"><Select allowClear showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="Status"><Select options={[{ value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On hold" }]} /></Form.Item></Col>
            <Col span={24}><Form.Item name="dates" label="Period"><DatePicker.RangePicker style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Requests pick a project when they are raised. Each workflow&apos;s cost field feeds the totals; see <Link href="/app/templates">Workflow designs → Rules</Link>.</Typography.Text>
        </Form>
      </Modal>
      {/* keep dayjs referenced for the range picker typing */}
      <span hidden>{dayjs().year()}</span>
    </div>
  );
}
