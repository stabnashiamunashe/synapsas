"use client";

import { App, Button, Card, Col, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Skeleton, Space, Switch, Table, Tag, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, LockOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusTag } from "@/components/StatusTag";
import { api, formatDate, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";
import { FILE_SERIES, RECORD_STATUS_LABELS } from "@/lib/recordTypes";

interface Named { id: string; name: string }
interface RFile { id: string; fileNo: string; title: string; series: string; description?: string | null; department?: Named | null; status: string; openedAt: string; closedAt?: string | null; retentionYears?: number | null; location?: string | null; confidential: boolean; _count: { records: number }; lastActivityAt?: string | null }
interface Detail extends RFile { records: { id: string; referenceNo: string; direction: "IN" | "OUT"; subject: string; party: string; status: string; dateLogged: string }[] }

function FilePlan() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const isAdmin = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.ADMIN : false;
  const isClerk = !!me && (me.org.settings.records?.clerkIds || []).includes(me.user.id);
  const canEdit = isManager || isClerk;
  const [q, setQ] = useState("");
  const [series, setSeries] = useState<string | undefined>();
  const [all, setAll] = useState(false);
  const { data, isLoading, mutate } = useApi<RFile[]>(`/api/record-files?${all ? "all=1&" : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}${series ? `series=${encodeURIComponent(series)}` : ""}`);
  const { data: departments } = useApi<Named[]>("/api/departments");
  // undefined = follow the ?open= query (deep links from notifications); a click or close takes over
  const [openState, setOpenState] = useState<string | null | undefined>(undefined);
  const openId = openState === undefined ? params.get("open") : openState;
  const setOpenId = (id: string | null) => setOpenState(id);
  const { data: detail, mutate: mutateDetail } = useApi<Detail>(openId ? `/api/record-files/${openId}` : null);
  const [editing, setEditing] = useState<RFile | "new" | null>(null);
  const [form] = Form.useForm();
  const close = () => { setOpenState(null); if (params.get("open")) router.replace("/app/records/files"); };

  const edit = (f: RFile | "new") => { setEditing(f); form.resetFields(); form.setFieldsValue(f === "new" ? { series: "Administration", confidential: false, retentionYears: 5 } : { ...f, departmentId: f.department?.id }); };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing === "new") await api("/api/record-files", { method: "POST", json: v });
      else if (editing) await api(`/api/record-files/${editing.id}`, { method: "PATCH", json: v });
      setEditing(null); mutate(); mutateDetail(); message.success("Saved");
    } catch (e) { message.error((e as Error).message); }
  };
  const setStatus = async (f: RFile, status: "OPEN" | "CLOSED") => {
    try { await api(`/api/record-files/${f.id}`, { method: "PATCH", json: { status } }); mutate(); mutateDetail(); message.success(status === "CLOSED" ? `File ${f.fileNo} closed` : `File ${f.fileNo} reopened`); } catch (e) { message.error((e as Error).message); }
  };
  const remove = async (f: RFile) => { try { await api(`/api/record-files/${f.id}`, { method: "DELETE" }); close(); mutate(); message.success("Deleted"); } catch (e) { message.error((e as Error).message); } };
  const d = detail;
  const seriesInUse = Array.from(new Set([...FILE_SERIES, ...(data || []).map((f) => f.series)]));

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">File plan</Typography.Title>
          <div className="muted">The council&apos;s classification scheme: every registered letter is placed on a numbered file in a series, with a custodian department, a retention period and the shelf where the paper file lives.</div>
        </div>
        <Space wrap>
          <Link href="/app/records"><Button>Correspondence register</Button></Link>
          {canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => edit("new")}>Open a file</Button>}
        </Space>
      </div>
      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Search file number or title" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
          <Select allowClear placeholder="Any series" value={series} onChange={setSeries} style={{ width: 220 }} options={seriesInUse.map((s) => ({ value: s, label: s }))} />
          <span><Switch size="small" checked={all} onChange={setAll} /> <span className="muted">Show closed files</span></span>
        </Space>
        {isLoading || !data ? <Skeleton active /> : data.length === 0 ? <Empty description="No files yet. Open the first file of the plan." /> : (
          <Table<RFile> rowKey="id" dataSource={data} size="small" pagination={{ pageSize: 30, hideOnSinglePage: true }} scroll={{ x: 900 }} onRow={(f) => ({ onClick: () => setOpenId(f.id), style: { cursor: "pointer" } })} columns={[
            { title: "File no", width: 150, render: (_, f) => <Space size={6}><span className="mono"><b>{f.fileNo}</b></span>{f.confidential && <LockOutlined />}</Space> },
            { title: "Title", render: (_, f) => <span>{f.title}{f.description ? <div className="muted" style={{ fontSize: 12 }}>{f.description}</div> : null}</span> },
            { title: "Series", width: 180, render: (_, f) => f.series },
            { title: "Custodian", width: 200, render: (_, f) => f.department?.name || <span className="muted">Registry</span> },
            { title: "Location", width: 150, render: (_, f) => f.location || <span className="muted">–</span> },
            { title: "Items", width: 70, align: "right", render: (_, f) => f._count.records || <span className="muted">0</span> },
            { title: "Last activity", width: 110, render: (_, f) => formatDate(f.lastActivityAt) || <span className="muted">–</span> },
            { title: "Status", width: 90, render: (_, f) => <StatusTag status={f.status} labels={{ OPEN: "Open", CLOSED: "Closed" }} /> },
          ]} />
        )}
      </Card>

      <Drawer open={!!openId} onClose={close} size={680} title={d ? <Space><span className="mono">{d.fileNo}</span><StatusTag status={d.status} labels={{ OPEN: "Open", CLOSED: "Closed" }} />{d.confidential && <Tag icon={<LockOutlined />}>Confidential</Tag>}</Space> : "File"}
        extra={d && canEdit && <Space><Button onClick={() => edit(d)}>Edit</Button>{d.status === "OPEN" ? <Popconfirm title={`Close file ${d.fileNo}? Nothing more can be placed on it.`} onConfirm={() => setStatus(d, "CLOSED")}><Button>Close file</Button></Popconfirm> : <Button onClick={() => setStatus(d, "OPEN")}>Reopen</Button>}{isAdmin && d._count.records === 0 && <Popconfirm title="Delete this empty file?" onConfirm={() => remove(d)}><Button danger>Delete</Button></Popconfirm>}</Space>}>
        {!d ? <Skeleton active /> : (
          <>
            <Typography.Title level={5} style={{ marginTop: 0 }}>{d.title}</Typography.Title>
            {d.description && <p style={{ whiteSpace: "pre-wrap" }}>{d.description}</p>}
            <Row gutter={[12, 6]} style={{ marginBottom: 16 }}>
              <Col span={8}><span className="muted">Series</span><div>{d.series}</div></Col>
              <Col span={8}><span className="muted">Custodian</span><div>{d.department?.name || "Registry"}</div></Col>
              <Col span={8}><span className="muted">Location</span><div>{d.location || "–"}</div></Col>
              <Col span={8}><span className="muted">Opened</span><div>{formatDate(d.openedAt)}</div></Col>
              <Col span={8}><span className="muted">Closed</span><div>{formatDate(d.closedAt) || "–"}</div></Col>
              <Col span={8}><span className="muted">Retention</span><div>{d.retentionYears != null ? `${d.retentionYears} years after closure${d.closedAt ? ` (until ${new Date(d.closedAt).getFullYear() + d.retentionYears})` : ""}` : "–"}</div></Col>
            </Row>
            <Typography.Title level={5}>Correspondence on this file ({d._count.records})</Typography.Title>
            {d.records.length === 0 ? <Empty description="Nothing has been placed on this file yet" /> : (
              <Table rowKey="id" dataSource={d.records} size="small" pagination={{ pageSize: 20, hideOnSinglePage: true }} columns={[
                { title: "Registry no", width: 180, render: (_, r) => <Link href={`/app/records?open=${r.id}`}>{r.direction === "IN" ? <ArrowDownOutlined style={{ color: "#0f62fe" }} /> : <ArrowUpOutlined style={{ color: "#198038" }} />} <span className="mono">{r.referenceNo}</span></Link> },
                { title: "Date", width: 100, render: (_, r) => formatDate(r.dateLogged) },
                { title: "Subject", render: (_, r) => <span>{r.subject}<div className="muted" style={{ fontSize: 12 }}>{r.direction === "IN" ? "From" : "To"} {r.party}</div></span> },
                { title: "Status", width: 130, render: (_, r) => <StatusTag status={r.status} labels={RECORD_STATUS_LABELS} /> },
              ]} />
            )}
          </>
        )}
      </Drawer>

      <Modal open={!!editing} title={editing === "new" ? "Open a file" : "Edit file"} onCancel={() => setEditing(null)} onOk={save} okText="Save" width={640} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={8}><Form.Item name="fileNo" label="File number" rules={[{ required: true }]}><Input placeholder="ADM/3/2" /></Form.Item></Col>
            <Col span={16}><Form.Item name="series" label="Series" rules={[{ required: true }]}><Select showSearch options={seriesInUse.map((s) => ({ value: s, label: s }))} /></Form.Item></Col>
            <Col span={24}><Form.Item name="title" label="Title" rules={[{ required: true, min: 2 }]}><Input placeholder="e.g. Correspondence with the Ministry of Local Government" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="Scope note"><Input.TextArea autoSize={{ minRows: 2 }} placeholder="What belongs on this file and what does not" /></Form.Item></Col>
            <Col span={12}><Form.Item name="departmentId" label="Custodian department"><Select allowClear showSearch optionFilterProp="label" placeholder="Registry" options={(departments || []).map((x) => ({ value: x.id, label: x.name }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="location" label="Physical location"><Input placeholder="e.g. Registry, cabinet 4, shelf B" /></Form.Item></Col>
            <Col span={12}><Form.Item name="retentionYears" label="Retention (years after closure)"><InputNumber min={0} max={200} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="confidential" label="Confidential file" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

export default function FilePlanPage() { return <Suspense><FilePlan /></Suspense>; }
