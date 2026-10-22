"use client";

import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { api, useApi } from "@/lib/client";

interface D { id: string; name: string; code?: string | null; headUserId?: string | null; head?: { id: string; name: string } | null; _count: { members: number } }

export default function DepartmentsPage() {
  const { message } = App.useApp();
  const { data, mutate, isLoading } = useApi<D[]>("/api/departments");
  const { data: users } = useApi<{ id: string; name: string }[]>("/api/users");
  const [editing, setEditing] = useState<D | "new" | null>(null);
  const [form] = Form.useForm();

  const open = (d: D | "new") => { setEditing(d); form.resetFields(); if (d !== "new") form.setFieldsValue(d); };
  const submit = async () => {
    const values = await form.validateFields();
    try {
      if (editing === "new") await api("/api/departments", { method: "POST", json: values });
      else if (editing) await api(`/api/departments/${editing.id}`, { method: "PATCH", json: values });
      setEditing(null); mutate(); message.success("Saved");
    } catch (e) { message.error((e as Error).message); }
  };
  const remove = async (d: D) => {
    try { await api(`/api/departments/${d.id}`, { method: "DELETE" }); mutate(); } catch (e) { message.error((e as Error).message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Departments</Typography.Title>
          <Typography.Text type="secondary">Department heads are used by “Department head” approval levels.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>Add department</Button>
      </div>
      <Table<D> rowKey="id" loading={isLoading} dataSource={data || []} pagination={false}
        columns={[
          { title: "Name", dataIndex: "name" },
          { title: "Code", dataIndex: "code", width: 100, render: (v) => v ? <span className="mono">{v}</span> : <span className="muted">–</span> },
          { title: "Head", width: 200, render: (_, d) => d.head?.name || <span className="muted">Not set</span> },
          { title: "Members", width: 100, render: (_, d) => d._count.members },
          { title: "", width: 140, render: (_, d) => <Space><a onClick={() => open(d)}>Edit</a><Popconfirm title="Delete department?" onConfirm={() => remove(d)}><a style={{ color: "#ff4d4f" }}>Delete</a></Popconfirm></Space> },
        ]} />
      <Modal open={!!editing} onCancel={() => setEditing(null)} onOk={submit} title={editing === "new" ? "Add department" : "Edit department"} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="Code"><Input placeholder="FIN" /></Form.Item>
          <Form.Item name="headUserId" label="Department head"><Select allowClear showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
