"use client";

import { App, Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useState } from "react";
import { api, formatMoney, useApi } from "@/lib/client";
import { LICENCE_CATEGORIES } from "@/lib/licenceTypes";

interface LType { id: string; code: string; name: string; category: string; description?: string | null; fee: number; currency: string; validityMonths: number; requiresInspection: boolean; requirements: string[]; department?: { id: string; name: string } | null; isActive: boolean; _count: { licences: number } }

/** Catalogue of licences and permits with fees, validity, inspection requirement and the document checklist. */
export default function LicenceTypesPage() {
  const { message } = App.useApp();
  const { data, isLoading, mutate } = useApi<LType[]>("/api/licence-types?all=1");
  const { data: departments } = useApi<{ id: string; name: string }[]>("/api/departments");
  const [editing, setEditing] = useState<LType | "new" | null>(null);
  const [form] = Form.useForm();
  const edit = (t: LType | "new") => { setEditing(t); form.resetFields(); form.setFieldsValue(t === "new" ? { category: "Trading", currency: "USD", validityMonths: 12, requiresInspection: true, isActive: true, requirements: "" } : { ...t, departmentId: t.department?.id, requirements: t.requirements.join("\n") }); };
  const save = async () => {
    const v = await form.validateFields();
    const json = { ...v, code: String(v.code).toUpperCase(), requirements: String(v.requirements || "").split("\n").map((s: string) => s.trim()).filter(Boolean) };
    try {
      if (editing === "new") await api("/api/licence-types", { method: "POST", json });
      else if (editing) await api(`/api/licence-types/${editing.id}`, { method: "PATCH", json });
      setEditing(null); mutate(); message.success("Licence type saved");
    } catch (e) { message.error((e as Error).message); }
  };
  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/app/licences" className="muted" style={{ fontSize: 13 }}><ArrowLeftOutlined /> Licensing</Link>
          <Typography.Title level={3} className="page-title" style={{ marginTop: 4 }}>Licence types & fees</Typography.Title>
          <Typography.Text type="secondary">The schedule of licences the council issues. Fees apply to new applications from the moment they are changed; issued licences are not affected.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => edit("new")}>Add licence type</Button>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table<LType> rowKey="id" loading={isLoading} dataSource={data || []} pagination={false} size="middle" scroll={{ x: 1300 }}
          columns={[
            { title: "Code", dataIndex: "code", width: 90, render: (v) => <span className="mono">{v}</span> },
            { title: "Licence", width: 380, render: (_, t) => <div><div style={{ fontWeight: 500 }}>{t.name}{!t.isActive && <Tag style={{ marginLeft: 8 }}>Inactive</Tag>}</div>{t.description && <div className="muted" style={{ fontSize: 12 }}>{t.description}</div>}</div> },
            { title: "Category", dataIndex: "category", width: 150 },
            { title: "Fee", width: 110, align: "right", render: (_, t) => formatMoney(t.fee, t.currency) },
            { title: "Validity", width: 100, render: (_, t) => `${t.validityMonths} mo` },
            { title: "Inspection", width: 110, render: (_, t) => (t.requiresInspection ? <Tag color="purple">Required</Tag> : <Tag>No</Tag>) },
            { title: "Documents", width: 110, render: (_, t) => t.requirements.length },
            { title: "Department", width: 220, render: (_, t) => t.department?.name || <span className="muted">–</span> },
            { title: "Issued", dataIndex: ["_count", "licences"], width: 80, align: "right" },
            { title: "", width: 100, render: (_, t) => <Space><Button size="small" type="text" icon={<EditOutlined />} onClick={() => edit(t)} /><Popconfirm title={t._count.licences ? "Deactivate this licence type?" : "Delete this licence type?"} onConfirm={async () => { try { const r = await api<{ deactivated?: boolean }>(`/api/licence-types/${t.id}`, { method: "DELETE" }); message.success(r.deactivated ? "Licence type deactivated" : "Licence type deleted"); mutate(); } catch (e) { message.error((e as Error).message); } }}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm></Space> },
          ]} />
      </Card>
      <Modal open={!!editing} onCancel={() => setEditing(null)} onOk={save} title={editing === "new" ? "Add licence type" : "Edit licence type"} okText="Save" width={680} destroyOnHidden>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col xs={24} md={6}><Form.Item name="code" label="Code" rules={[{ required: true, pattern: /^[A-Za-z0-9]{2,16}$/, message: "2–16 letters/digits" }]}><Input placeholder="SHP" style={{ textTransform: "uppercase" }} /></Form.Item></Col>
            <Col xs={24} md={18}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="Shop licence" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="category" label="Category" rules={[{ required: true }]}><Select options={LICENCE_CATEGORIES.map((c) => ({ value: c, label: c }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="departmentId" label="Owning department" extra="Its head is notified of new applications and approves"><Select allowClear options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="fee" label="Fee" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="currency" label="Currency"><Select options={["USD", "ZWG", "ZAR"].map((c) => ({ value: c, label: c }))} /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="validityMonths" label="Validity (months)" rules={[{ required: true }]}><InputNumber min={1} max={600} style={{ width: "100%" }} /></Form.Item></Col>
            <Col xs={12} md={3}><Form.Item name="requiresInspection" label="Inspection" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col xs={12} md={3}><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col xs={24}><Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="requirements" label="Required documents (one per line)"><Input.TextArea rows={5} placeholder={"Copy of national ID\nProof of stand ownership or lease\nTax clearance (ZIMRA)\nHealth inspection report"} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
