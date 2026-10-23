"use client";

import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { ArrowLeftOutlined, PlusOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState } from "react";
import { api, useApi } from "@/lib/client";
import { CASE_PRIORITIES, CASE_PRIORITY_LABELS, type CasePriority } from "@/lib/caseTypes";
import { PriorityDot } from "@/components/cases/CaseBits";

interface Cat { id: string; name: string; description?: string | null; departmentId: string; department: { id: string; name: string }; defaultPriority: CasePriority; defaultSlaHours: number; icon?: string | null; isPublic: boolean; isActive: boolean; _count: { cases: number } }

export default function CaseCategoriesPage() {
  const { message } = App.useApp();
  const { data, mutate } = useApi<Cat[]>("/api/case-categories");
  const { data: departments } = useApi<{ id: string; name: string }[]>("/api/departments");
  const [editing, setEditing] = useState<Cat | "new" | null>(null);
  const [form] = Form.useForm();
  const open = (c: Cat | "new") => { setEditing(c); form.resetFields(); form.setFieldsValue(c === "new" ? { defaultPriority: "MEDIUM", defaultSlaHours: 72, isPublic: true, isActive: true } : c); };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing === "new") await api("/api/case-categories", { method: "POST", json: v });
      else if (editing) await api(`/api/case-categories/${editing.id}`, { method: "PATCH", json: v });
      setEditing(null); mutate(); message.success("Saved");
    } catch (e) { message.error((e as Error).message); }
  };
  return (
    <div>
      <div className="page-header">
        <div className="page-head-left">
          <Link href="/app/cases"><Button type="text" icon={<ArrowLeftOutlined />} /></Link>
          <div><div className="title-row"><Typography.Title level={3} className="page-title">Case categories & SLAs</Typography.Title></div><div className="muted">Each category routes to a section and carries a service target in hours.</div></div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>Add category</Button>
      </div>
      <Card>
        <Table<Cat> rowKey="id" dataSource={data || []} pagination={false} size="small" columns={[
          { title: "Category", render: (_, c) => <span>{c.icon ? `${c.icon} ` : ""}<b>{c.name}</b>{c.description && <div className="muted" style={{ fontSize: 12 }}>{c.description}</div>}</span> },
          { title: "Section", render: (_, c) => c.department?.name },
          { title: "SLA", dataIndex: "defaultSlaHours", width: 90, render: (h) => `${h} h` },
          { title: "Priority", dataIndex: "defaultPriority", width: 110, render: (p: CasePriority) => <PriorityDot priority={p} withLabel /> },
          { title: "Public", dataIndex: "isPublic", width: 90, render: (v) => (v ? <Tag color="green">yes</Tag> : <Tag>no</Tag>) },
          { title: "Active", dataIndex: "isActive", width: 90, render: (v) => (v ? <Tag color="blue">active</Tag> : <Tag>off</Tag>) },
          { title: "Cases", width: 80, render: (_, c) => c._count.cases },
          { title: "", width: 140, render: (_, c) => <Space><a onClick={() => open(c)}>Edit</a><Popconfirm title={c._count.cases ? "Deactivate this category?" : "Delete this category?"} onConfirm={async () => { await api(`/api/case-categories/${c.id}`, { method: "DELETE" }); mutate(); }}><a style={{ color: "#c53030" }}>{c._count.cases ? "Deactivate" : "Delete"}</a></Popconfirm></Space> },
        ]} />
      </Card>
      <Modal open={!!editing} title={editing === "new" ? "Add category" : "Edit category"} onCancel={() => setEditing(null)} onOk={save} okText="Save" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}><Input placeholder="e.g. Email / network access" /></Form.Item>
          <Form.Item name="departmentId" label="Section that handles it" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Form.Item>
          <Form.Item name="description" label="Description (shown on the public form)"><Input.TextArea autoSize={{ minRows: 2 }} /></Form.Item>
          <Space size="large" wrap>
            <Form.Item name="defaultSlaHours" label="SLA (hours)" rules={[{ required: true }]}><InputNumber min={1} max={2160} /></Form.Item>
            <Form.Item name="defaultPriority" label="Default priority"><Select style={{ width: 140 }} options={CASE_PRIORITIES.map((p) => ({ value: p, label: CASE_PRIORITY_LABELS[p] }))} /></Form.Item>
            <Form.Item name="icon" label="Icon (emoji)"><Input style={{ width: 80 }} maxLength={4} /></Form.Item>
            <Form.Item name="isPublic" label="On public form" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
