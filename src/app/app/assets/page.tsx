"use client";

import { App, Button, Card, Col, DatePicker, Drawer, Empty, Form, Input, InputNumber, Modal, Row, Segmented, Select, Skeleton, Space, Table, Tag, Timeline, Typography } from "antd";
import { DownloadOutlined, LaptopOutlined, PlusOutlined, SearchOutlined, ToolOutlined, UserOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatCard } from "@/components/StatCard";
import { api, downloadUrl, formatDate, formatMoney, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";

interface Asset { id: string; tag: string; category: string; make?: string | null; model?: string | null; serial?: string | null; status: string; assignedTo?: { id: string; name: string } | null; department?: { id: string; name: string; code?: string | null } | null; location?: string | null; purchaseDate?: string | null; purchaseCost?: number | null; warrantyUntil?: string | null; notes?: string | null; _count: { cases: number } }
interface Detail extends Asset { events: { id: string; kind: string; note?: string | null; createdAt: string; actor?: { name: string } | null; toUserId?: string | null }[]; cases: { id: string; referenceNo: string; title: string; status: string; createdAt: string }[] }
interface Resp { items: Asset[]; counts: Record<string, number> }

export const ASSET_STATUS: Record<string, { label: string; color: string }> = { IN_STORE: { label: "In store", color: "default" }, ISSUED: { label: "Issued", color: "blue" }, IN_REPAIR: { label: "In repair", color: "gold" }, LOST: { label: "Lost", color: "red" }, DISPOSED: { label: "Disposed", color: "default" } };
const CATEGORIES = ["Laptop", "Desktop", "Monitor", "Printer", "Tablet", "Phone", "GPS / PDA", "Camera", "Projector", "Server / network", "Furniture", "Vehicle accessory", "Other"];
const EVENT_LABEL: Record<string, string> = { CREATED: "Added to register", ISSUED: "Issued", RETURNED: "Returned to store", REPAIR: "Sent for repair", REPAIRED: "Back from repair", LOST: "Reported lost", DISPOSED: "Disposed", NOTE: "Note" };

function Assets() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const params = useSearchParams();
  const [scope, setScope] = useState<"all" | "mine">(params.get("mine") === "1" ? "mine" : "all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const url = `/api/assets?${scope === "mine" || !isManager ? "mine=1&" : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}${status ? `status=${status}` : ""}`;
  const { data, isLoading, mutate } = useApi<Resp>(url);
  const { data: users } = useApi<{ id: string; name: string }[]>(isManager ? "/api/users?active=1" : null);
  const { data: departments } = useApi<{ id: string; name: string }[]>(isManager ? "/api/departments" : null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: detail, mutate: mutateDetail } = useApi<Detail>(openId ? `/api/assets/${openId}` : null);
  const [editing, setEditing] = useState<Asset | "new" | null>(null);
  const [moving, setMoving] = useState<{ kind: string } | null>(null);
  const [form] = Form.useForm();
  const [moveForm] = Form.useForm();

  const save = async () => {
    const v = await form.validateFields();
    const json = { ...v, purchaseDate: v.purchaseDate ? v.purchaseDate.format("YYYY-MM-DD") : null, warrantyUntil: v.warrantyUntil ? v.warrantyUntil.format("YYYY-MM-DD") : null };
    try {
      if (editing === "new") await api("/api/assets", { method: "POST", json });
      else if (editing) await api(`/api/assets/${editing.id}`, { method: "PATCH", json });
      setEditing(null); mutate(); mutateDetail(); message.success("Saved");
    } catch (e) { message.error((e as Error).message); }
  };
  const move = async () => {
    const v = await moveForm.validateFields();
    try { await api(`/api/assets/${openId}`, { method: "POST", json: { kind: moving!.kind, ...v } }); setMoving(null); mutate(); mutateDetail(); message.success("Recorded"); } catch (e) { message.error((e as Error).message); }
  };
  const edit = (a: Asset | "new") => { setEditing(a); form.resetFields(); form.setFieldsValue(a === "new" ? { category: "Laptop", status: "IN_STORE" } : { ...a, assignedToId: a.assignedTo?.id, departmentId: a.department?.id, purchaseDate: a.purchaseDate ? dayjs(a.purchaseDate) : null, warrantyUntil: a.warrantyUntil ? dayjs(a.warrantyUntil) : null }); };
  const c = data?.counts || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Asset register</Typography.Title>
          <div className="muted">ICT equipment and other assets: who holds what, movements, repairs and the faults logged against each item.</div>
        </div>
        <Space wrap>
          {isManager && <Segmented value={scope} onChange={(v) => setScope(v as "all" | "mine")} options={[{ value: "all", label: "Register" }, { value: "mine", label: "Issued to me" }]} />}
          {isManager && <Button icon={<DownloadOutlined />} onClick={() => downloadUrl("/api/assets?format=csv")}>CSV</Button>}
          {isManager && <Button type="primary" icon={<PlusOutlined />} onClick={() => edit("new")}>Add asset</Button>}
        </Space>
      </div>
      {isManager && scope === "all" && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><StatCard tone="blue" icon={<UserOutlined />} value={c.ISSUED || 0} label="Issued" onClick={() => setStatus("ISSUED")} /></Col>
          <Col xs={12} md={6}><StatCard tone="green" icon={<LaptopOutlined />} value={c.IN_STORE || 0} label="In store" onClick={() => setStatus("IN_STORE")} /></Col>
          <Col xs={12} md={6}><StatCard tone="orange" icon={<ToolOutlined />} value={c.IN_REPAIR || 0} label="In repair" onClick={() => setStatus("IN_REPAIR")} /></Col>
          <Col xs={12} md={6}><StatCard tone="grey" icon={<WarningOutlined />} value={(c.LOST || 0) + (c.DISPOSED || 0)} label="Lost / disposed" onClick={() => setStatus("LOST,DISPOSED")} /></Col>
        </Row>
      )}
      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Search tag, serial, make, holder" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
          <Select allowClear placeholder="Any status" value={status} onChange={setStatus} style={{ width: 160 }} options={Object.entries(ASSET_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
        </Space>
        {isLoading || !data ? <Skeleton active /> : data.items.length === 0 ? <Empty description={scope === "mine" || !isManager ? "Nothing is issued to you" : "No assets match"} /> : (
          <Table<Asset> rowKey="id" dataSource={data.items} size="small" pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 900 }} onRow={(a) => ({ onClick: () => setOpenId(a.id), style: { cursor: "pointer" } })} columns={[
            { title: "Tag", width: 140, render: (_, a) => <span className="mono"><b>{a.tag}</b></span> },
            { title: "Item", render: (_, a) => <span>{a.category}<div className="muted" style={{ fontSize: 12 }}>{[a.make, a.model].filter(Boolean).join(" ")}{a.serial ? ` · S/N ${a.serial}` : ""}</div></span> },
            { title: "Status", width: 110, render: (_, a) => <Tag color={ASSET_STATUS[a.status]?.color}>{ASSET_STATUS[a.status]?.label || a.status}</Tag> },
            { title: "Holder", render: (_, a) => a.assignedTo?.name || <span className="muted">–</span> },
            { title: "Section / location", render: (_, a) => <span>{a.department?.name}{a.location ? <div className="muted" style={{ fontSize: 12 }}>{a.location}</div> : null}</span> },
            { title: "Warranty", width: 120, render: (_, a) => a.warrantyUntil ? <span style={{ color: new Date(a.warrantyUntil) < new Date() ? "#9aa3b2" : undefined }}>{formatDate(a.warrantyUntil)}</span> : <span className="muted">–</span> },
            { title: "Cases", width: 70, align: "center", render: (_, a) => a._count.cases || "" },
          ]} />
        )}
      </Card>

      <Drawer open={!!openId} onClose={() => setOpenId(null)} size={620} title={detail ? <span className="mono">{detail.tag}</span> : "Asset"} extra={detail && isManager && <Space><Button onClick={() => edit(detail)}>Edit</Button></Space>}>
        {!detail ? <Skeleton active /> : (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={ASSET_STATUS[detail.status]?.color}>{ASSET_STATUS[detail.status]?.label}</Tag>
              <b>{detail.category}</b> {[detail.make, detail.model].filter(Boolean).join(" ")}
            </Space>
            <Row gutter={[12, 6]} style={{ marginBottom: 12 }}>
              <Col span={12}><span className="muted">Serial</span><div>{detail.serial || "–"}</div></Col>
              <Col span={12}><span className="muted">Holder</span><div>{detail.assignedTo?.name || "In store"}</div></Col>
              <Col span={12}><span className="muted">Section</span><div>{detail.department?.name || "–"}</div></Col>
              <Col span={12}><span className="muted">Location</span><div>{detail.location || "–"}</div></Col>
              <Col span={12}><span className="muted">Purchased</span><div>{formatDate(detail.purchaseDate) || "–"}{detail.purchaseCost != null ? ` · ${formatMoney(detail.purchaseCost)}` : ""}</div></Col>
              <Col span={12}><span className="muted">Warranty until</span><div>{formatDate(detail.warrantyUntil) || "–"}</div></Col>
              {detail.notes && <Col span={24}><span className="muted">Notes</span><div style={{ whiteSpace: "pre-wrap" }}>{detail.notes}</div></Col>}
            </Row>
            {isManager && (
              <Space wrap style={{ marginBottom: 16 }}>
                {detail.status !== "DISPOSED" && detail.status !== "ISSUED" && <Button type="primary" onClick={() => { setMoving({ kind: "ISSUED" }); moveForm.resetFields(); }}>Issue to officer</Button>}
                {detail.status === "ISSUED" && <Button onClick={() => { setMoving({ kind: "RETURNED" }); moveForm.resetFields(); }}>Return to store</Button>}
                {detail.status !== "IN_REPAIR" && detail.status !== "DISPOSED" && <Button onClick={() => { setMoving({ kind: "REPAIR" }); moveForm.resetFields(); }}>Send for repair</Button>}
                {detail.status === "IN_REPAIR" && <Button onClick={() => { setMoving({ kind: "REPAIRED" }); moveForm.resetFields(); }}>Repaired</Button>}
                {detail.status !== "LOST" && detail.status !== "DISPOSED" && <Button danger onClick={() => { setMoving({ kind: "LOST" }); moveForm.resetFields(); }}>Lost</Button>}
                {detail.status !== "DISPOSED" && <Button danger onClick={() => { setMoving({ kind: "DISPOSED" }); moveForm.resetFields(); }}>Dispose</Button>}
                <Button onClick={() => { setMoving({ kind: "NOTE" }); moveForm.resetFields(); }}>Add note</Button>
              </Space>
            )}
            {detail.cases.length > 0 && (
              <Card size="small" title="Faults and requests logged against this asset" style={{ marginBottom: 16 }}>
                {detail.cases.map((k) => <div key={k.id}><Link href={`/app/cases?open=${k.id}`}><span className="mono">{k.referenceNo}</span> {k.title}</Link> <Tag style={{ marginLeft: 6 }}>{k.status.replace(/_/g, " ").toLowerCase()}</Tag></div>)}
              </Card>
            )}
            <Typography.Title level={5}>History</Typography.Title>
            <Timeline items={detail.events.map((e) => ({ color: e.kind === "LOST" || e.kind === "DISPOSED" ? "red" : e.kind === "REPAIR" ? "orange" : e.kind === "ISSUED" ? "blue" : "green", content: <span><b>{EVENT_LABEL[e.kind] || e.kind}</b>{e.kind === "ISSUED" && e.toUserId ? ` to ${users?.find((u) => u.id === e.toUserId)?.name || detail.assignedTo?.name || "officer"}` : ""}{e.note ? ` · ${e.note}` : ""}<div className="muted" style={{ fontSize: 12 }}>{formatDate(e.createdAt, true)}{e.actor ? ` · ${e.actor.name}` : ""}</div></span> }))} />
          </>
        )}
      </Drawer>

      <Modal open={!!moving} title={moving ? EVENT_LABEL[moving.kind] : ""} onCancel={() => setMoving(null)} onOk={move} okText="Record" destroyOnHidden>
        <Form form={moveForm} layout="vertical">
          {moving?.kind === "ISSUED" && <Form.Item name="toUserId" label="Issue to" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>}
          <Form.Item name="note" label={moving?.kind === "NOTE" ? "Note" : "Note (optional)"} rules={moving?.kind === "NOTE" ? [{ required: true }] : []}><Input.TextArea autoSize={{ minRows: 2 }} placeholder={moving?.kind === "REPAIR" ? "Fault and repairer, e.g. screen cracked, sent to supplier" : moving?.kind === "ISSUED" ? "Condition on issue, accessories" : ""} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={!!editing} title={editing === "new" ? "Add asset" : "Edit asset"} onCancel={() => setEditing(null)} onOk={save} okText="Save" width={680} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={8}><Form.Item name="tag" label="Asset tag" rules={[{ required: true }]}><Input placeholder="ZS/ICT/0042" /></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="Category" rules={[{ required: true }]}><Select showSearch options={CATEGORIES.map((x) => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="serial" label="Serial number"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="make" label="Make"><Input placeholder="e.g. HP" /></Form.Item></Col>
            <Col span={12}><Form.Item name="model" label="Model"><Input placeholder="e.g. ProBook 450 G9" /></Form.Item></Col>
            {editing === "new" && <Col span={12}><Form.Item name="assignedToId" label="Issue to (optional)"><Select allowClear showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item></Col>}
            <Col span={12}><Form.Item name="departmentId" label="Section"><Select allowClear showSearch optionFilterProp="label" options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="location" label="Location"><Input placeholder="e.g. Head Office, Room 214" /></Form.Item></Col>
            <Col span={8}><Form.Item name="purchaseDate" label="Purchased"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="purchaseCost" label="Cost (USD)"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="warrantyUntil" label="Warranty until"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="Notes"><Input.TextArea autoSize={{ minRows: 2 }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

export default function AssetsPage() { return <Suspense><Assets /></Suspense>; }
