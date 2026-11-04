"use client";

import { App, Button, Card, Checkbox, Col, DatePicker, Descriptions, Drawer, Dropdown, Empty, Form, Input, InputNumber, Modal, Radio, Row, Segmented, Select, Skeleton, Space, Table, Tag, Timeline, Tooltip, Typography } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, DollarOutlined, DownloadOutlined, DownOutlined, FileProtectOutlined, PlusOutlined, PrinterOutlined, SearchOutlined, SettingOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { PriorityTag, StatusTag } from "@/components/StatusTag";
import { api, downloadUrl, formatDate, formatMoney, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";
import { LICENCE_ACTION_LABELS, LICENCE_CATEGORIES, LICENCE_EVENT_LABELS, LICENCE_STATUSES, LICENCE_STATUS_LABELS, LICENCE_TRANSITIONS, daysUntil, type LicenceAction, type LicenceStatus } from "@/lib/licenceTypes";

interface Lic {
  id: string; referenceNo: string; licenceNo?: string | null; status: LicenceStatus; priority: string; source?: string; applicantName: string; tradingName?: string | null; idNumber?: string | null; phone?: string | null; email?: string | null;
  standNumber?: string | null; address?: string | null; ward?: string | null; activity?: string | null; feeAmount: number; currency: string; paidAt?: string | null; receiptNo?: string | null;
  inspectionDue?: string | null; inspectedAt?: string | null; inspectionOutcome?: string | null; inspectionNotes?: string | null; conditions?: string | null; decisionNote?: string | null;
  issuedAt?: string | null; expiresAt?: string | null; submittedAt: string; updatedAt: string; documents: { name: string; received: boolean }[];
  type: { id: string; code: string; name: string; category: string; validityMonths: number; requiresInspection: boolean }; officer?: { id: string; name: string } | null; inspector?: { id: string; name: string } | null;
}
interface Detail extends Lic { attachments?: { id: string; label?: string | null; fileName: string; size: number; createdAt: string; uploadedBy?: string }[]; events: { id: string; kind: string; fromStatus?: string | null; toStatus?: string | null; note?: string | null; createdAt: string; actor?: { name: string } | null }[]; renewedFrom?: { id: string; referenceNo: string; licenceNo?: string | null } | null; renewals: { id: string; referenceNo: string; licenceNo?: string | null; status: string }[] }
interface Resp { items: Lic[]; counts: Record<string, number>; expiringSoon: number; revenueYtd: number }
interface LType { id: string; code: string; name: string; category: string; fee: number; validityMonths: number; requiresInspection: boolean }

const LIC_LABELS: Record<string, string> = { APPROVED: "Approved · fee due" };
const OUTCOME_LABEL: Record<string, string> = { PASS: "Passed", FAIL: "Failed", CONDITIONAL: "Passed with conditions" };

function Expiry({ d }: { d?: string | null }) {
  if (!d) return <span className="muted">–</span>;
  const days = daysUntil(d)!;
  const color = days < 0 ? "#da1e28" : days <= 30 ? "#b28600" : undefined;
  return <Tooltip title={days < 0 ? `${-days} days ago` : `${days} days left`}><span style={{ color, fontWeight: color ? 600 : undefined }}>{formatDate(d)}</span></Tooltip>;
}

function Licences() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const isAdmin = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.ADMIN : false;
  const [scope, setScope] = useState<string>(params.get("scope") || "open");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [typeId, setTypeId] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const scopeQs = scope === "open" ? "open=1&" : scope === "issued" ? "status=ISSUED&" : scope === "expiring" ? "expiring=30&" : scope === "mine" ? "mine=1&" : "";
  const url = `/api/licences?${status.length ? "" : scopeQs}${q ? `q=${encodeURIComponent(q)}&` : ""}${status.length ? `status=${status.join(",")}&` : ""}${typeId ? `typeId=${typeId}&` : ""}${category ? `category=${encodeURIComponent(category)}` : ""}`;
  const { data, isLoading, mutate } = useApi<Resp>(url);
  const { data: types } = useApi<LType[]>("/api/licence-types");
  const { data: users } = useApi<{ id: string; name: string }[]>("/api/users?active=1");
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  useEffect(() => { const o = params.get("open"); if (o) setOpenId(o); }, [params]);
  const { data: detail, mutate: mutateDetail } = useApi<Detail>(openId ? `/api/licences/${openId}` : null);
  const [acting, setActing] = useState<LicenceAction | null>(null);
  const [form] = Form.useForm();
  const [docs, setDocs] = useState<{ name: string; received: boolean }[] | null>(null);
  const show = (id: string | null) => { setDocs(null); setOpenId(id); };

  const run = async () => {
    const v = await form.validateFields();
    const json = { action: acting, ...v, inspectionDue: v.inspectionDue ? v.inspectionDue.format("YYYY-MM-DD") : undefined, paidAt: v.paidAt ? v.paidAt.format("YYYY-MM-DD") : undefined, issuedAt: v.issuedAt ? v.issuedAt.format("YYYY-MM-DD") : undefined };
    try {
      const res = await api<Lic & { renewalOf?: string }>(`/api/licences/${openId}`, { method: "POST", json });
      setActing(null); mutate();
      if (acting === "renew") { message.success(`Renewal application ${res.referenceNo} opened`); show(res.id); }
      else { mutateDetail(); message.success(acting === "issue" ? `Licence ${res.licenceNo} issued` : `${LICENCE_ACTION_LABELS[acting!]}: done`); }
    } catch (e) { message.error((e as Error).message); }
  };
  const saveDocs = async () => {
    try { await api(`/api/licences/${openId}`, { method: "POST", json: { action: "document", documents: docs } }); setDocs(null); mutateDetail(); mutate(); message.success("Document checklist updated"); } catch (e) { message.error((e as Error).message); }
  };

  const c = data?.counts || {};
  const open = (c.SUBMITTED || 0) + (c.UNDER_REVIEW || 0) + (c.INSPECTION || 0) + (c.APPROVED || 0);
  const actionsFor = (l: Lic): LicenceAction[] => (LICENCE_TRANSITIONS[l.status] || []).filter((a) => a !== "document" && (isManager || !["approve", "reject", "issue", "suspend", "reinstate", "revoke", "cancel"].includes(a)));
  const primaryAction = (l: Lic): LicenceAction | null => {
    const a = actionsFor(l);
    if (l.status === "SUBMITTED") return a.includes("review") ? "review" : null;
    if (l.status === "UNDER_REVIEW") return l.type.requiresInspection && (!l.inspectedAt || l.inspectionOutcome === "FAIL") ? "schedule_inspection" : a.includes("approve") ? "approve" : null;
    if (l.status === "INSPECTION") return "record_inspection";
    if (l.status === "APPROVED") return l.paidAt ? (a.includes("issue") ? "issue" : null) : "pay";
    if (l.status === "EXPIRED") return "renew";
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Licensing</Typography.Title>
          <Typography.Text type="secondary">Shop, liquor, hawker, health, building and other council licences: applications, inspections, fees, certificates and renewals.</Typography.Text>
        </div>
        <Space wrap>
          {isAdmin && <Link href="/app/licences/types"><Button icon={<SettingOutlined />}>Licence types & fees</Button></Link>}
          <Button icon={<DownloadOutlined />} onClick={() => downloadUrl(url.replace("/api/licences?", "/api/licences?format=csv&"))}>Export</Button>
          <Link href="/app/licences/new"><Button type="primary" icon={<PlusOutlined />}>New application</Button></Link>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6} xl={4}><StatCard tone="blue" icon={<ClockCircleOutlined />} value={open} label="Awaiting action" onClick={() => { setScope("open"); setStatus([]); }} hint={<span className="muted">{c.SUBMITTED || 0} new · {c.INSPECTION || 0} at inspection</span>} /></Col>
        <Col xs={12} md={6} xl={4}><StatCard tone="purple" icon={<SearchOutlined />} value={c.INSPECTION || 0} label="Inspections pending" onClick={() => setStatus(["INSPECTION"])} /></Col>
        <Col xs={12} md={6} xl={4}><StatCard tone="green" icon={<CheckCircleOutlined />} value={c.ISSUED || 0} label="Issued & valid" onClick={() => { setScope("issued"); setStatus([]); }} /></Col>
        <Col xs={12} md={6} xl={4}><StatCard tone="orange" icon={<WarningOutlined />} value={data?.expiringSoon ?? 0} label="Expiring in 30 days" onClick={() => { setScope("expiring"); setStatus([]); }} hint={<span className="muted">{c.EXPIRED || 0} already expired</span>} /></Col>
        <Col xs={12} md={6} xl={4}><StatCard tone="green" icon={<DollarOutlined />} value={formatMoney(data?.revenueYtd ?? 0)} label="Fees collected this year" /></Col>
        <Col xs={12} md={6} xl={4}><StatCard tone="grey" icon={<FileProtectOutlined />} value={(c.SUSPENDED || 0) + (c.REVOKED || 0)} label="Suspended / revoked" onClick={() => setStatus(["SUSPENDED", "REVOKED"])} /></Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <div style={{ padding: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <Segmented value={status.length ? "custom" : scope} onChange={(v) => { setStatus([]); setScope(String(v)); }} options={[{ label: "Needs action", value: "open" }, { label: "Issued", value: "issued" }, { label: "Expiring", value: "expiring" }, { label: "Mine", value: "mine" }, { label: "All", value: "all" }, ...(status.length ? [{ label: "Filtered", value: "custom" }] : [])]} />
          <Input allowClear prefix={<SearchOutlined />} placeholder="Applicant, trading name, stand, licence no." style={{ width: 300 }} value={q} onChange={(e) => setQ(e.target.value)} />
          <Select allowClear mode="multiple" placeholder="Status" style={{ minWidth: 180 }} value={status} onChange={setStatus} options={LICENCE_STATUSES.map((s) => ({ value: s, label: LICENCE_STATUS_LABELS[s] }))} maxTagCount="responsive" />
          <Select allowClear showSearch optionFilterProp="label" placeholder="Licence type" style={{ minWidth: 220 }} value={typeId} onChange={setTypeId} options={(types || []).map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))} />
          <Select allowClear placeholder="Category" style={{ minWidth: 160 }} value={category} onChange={setCategory} options={LICENCE_CATEGORIES.map((x) => ({ value: x, label: x }))} />
        </div>
        <Table<Lic> rowKey="id" loading={isLoading} dataSource={data?.items || []} pagination={{ pageSize: 25, showSizeChanger: false }} size="middle" scroll={{ x: 1100 }}
          onRow={(l) => ({ onClick: () => show(l.id), style: { cursor: "pointer" } })}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No licences match" /> }}
          columns={[
            { title: "Reference", width: 150, render: (_, l) => <div><div className="mono">{l.licenceNo || l.referenceNo}</div>{l.licenceNo && <div className="muted" style={{ fontSize: 12 }}>{l.referenceNo}</div>}</div> },
            { title: "Licence", width: 200, render: (_, l) => <div><div>{l.type.name}</div><div className="muted" style={{ fontSize: 12 }}>{l.type.category}</div></div> },
            { title: "Applicant", width: 260, render: (_, l) => <div><div style={{ fontWeight: 500 }}>{l.tradingName || l.applicantName}{l.source && l.source !== "STAFF" && <Tag style={{ marginLeft: 6, fontSize: 11, lineHeight: "16px" }} color={l.source === "WHATSAPP" ? "green" : "blue"}>{l.source === "WHATSAPP" ? "WhatsApp" : "Portal"}</Tag>}</div><div className="muted" style={{ fontSize: 12 }}>{l.tradingName ? `${l.applicantName} · ` : ""}{[l.standNumber ? `Stand ${l.standNumber}` : null, l.ward ? `Ward ${l.ward}` : null].filter(Boolean).join(", ")}</div></div> },
            { title: "Priority", width: 110, render: (_, l) => <PriorityTag priority={l.priority} /> },
            { title: "Status", width: 170, render: (_, l) => <StatusTag status={l.status} labels={LIC_LABELS} /> },
            { title: "Fee", width: 120, align: "right", render: (_, l) => <span>{formatMoney(l.feeAmount, l.currency)}<div className="muted" style={{ fontSize: 12 }}>{l.paidAt ? `paid ${formatDate(l.paidAt)}` : "unpaid"}</div></span> },
            { title: "Expires", width: 130, render: (_, l) => <Expiry d={l.expiresAt} />, sorter: (a, b) => new Date(a.expiresAt || 0).getTime() - new Date(b.expiresAt || 0).getTime() },
            { title: "Officer", width: 140, render: (_, l) => l.officer?.name || <span className="muted">Unassigned</span> },
          ]} />
      </Card>

      <Drawer open={!!openId} onClose={() => { show(null); router.replace("/app/licences"); }} size={760} styles={{ body: { paddingTop: 16 } }}
        title={detail ? <Space wrap><span className="mono">{detail.licenceNo || detail.referenceNo}</span><StatusTag status={detail.status} labels={LIC_LABELS} /><PriorityTag priority={detail.priority} /></Space> : "Licence"}
        extra={detail && (
          <Space>
            {detail.licenceNo && <Button icon={<PrinterOutlined />} onClick={() => window.open(`/api/licences/${detail.id}/certificate`, "_blank", "noopener")}>Certificate</Button>}
            {primaryAction(detail) && <Button type="primary" onClick={() => { setActing(primaryAction(detail)); }}>{LICENCE_ACTION_LABELS[primaryAction(detail)!]}</Button>}
            {actionsFor(detail).filter((a) => a !== primaryAction(detail)).length > 0 && (
              <Dropdown menu={{ items: actionsFor(detail).filter((a) => a !== primaryAction(detail)).map((a) => ({ key: a, label: LICENCE_ACTION_LABELS[a], danger: ["reject", "revoke", "suspend", "cancel"].includes(a) })), onClick: ({ key }) => { setActing(key as LicenceAction); } }}>
                <Button>More <DownOutlined /></Button>
              </Dropdown>
            )}
          </Space>
        )}>
        {!detail ? <Skeleton active /> : (
          <div>
            <Typography.Title level={4} style={{ marginTop: 0 }}>{detail.type.name}</Typography.Title>
            <Typography.Text type="secondary">{detail.type.category} · valid for {detail.type.validityMonths} months{detail.type.requiresInspection ? " · inspection required" : ""}{detail.source === "WHATSAPP" ? " · applied via WhatsApp" : detail.source === "PUBLIC" ? " · applied on the public portal" : ""}</Typography.Text>
            {detail.status === "APPROVED" && !detail.paidAt && <Tag color="gold" style={{ marginLeft: 8 }}>Fee outstanding: {formatMoney(detail.feeAmount, detail.currency)}</Tag>}
            {detail.inspectionOutcome === "FAIL" && detail.status !== "REJECTED" && <Tag color="red" style={{ marginLeft: 8 }}>Last inspection failed</Tag>}
            <Descriptions column={2} size="small" bordered style={{ marginTop: 16 }}>
              <Descriptions.Item label="Applicant">{detail.applicantName}{detail.idNumber ? <span className="muted"> · {detail.idNumber}</span> : null}</Descriptions.Item>
              <Descriptions.Item label="Trading as">{detail.tradingName || "–"}</Descriptions.Item>
              <Descriptions.Item label="Contact">{[detail.phone, detail.email].filter(Boolean).join(" · ") || "–"}</Descriptions.Item>
              <Descriptions.Item label="Premises">{[detail.standNumber ? `Stand ${detail.standNumber}` : null, detail.address, detail.ward ? `Ward ${detail.ward}` : null].filter(Boolean).join(", ") || "–"}</Descriptions.Item>
              <Descriptions.Item label="Activity" span={2}>{detail.activity || "–"}</Descriptions.Item>
              <Descriptions.Item label="Officer">{detail.officer?.name || "Unassigned"}</Descriptions.Item>
              <Descriptions.Item label="Inspector">{detail.inspector ? <span>{detail.inspector.name}{detail.inspectionDue && !detail.inspectedAt ? <span className="muted"> · due {formatDate(detail.inspectionDue)}</span> : null}</span> : "–"}</Descriptions.Item>
              <Descriptions.Item label="Inspection">{detail.inspectedAt ? <span><Tag color={detail.inspectionOutcome === "PASS" ? "green" : detail.inspectionOutcome === "FAIL" ? "red" : "gold"}>{OUTCOME_LABEL[detail.inspectionOutcome || ""]}</Tag>{formatDate(detail.inspectedAt)}{detail.inspectionNotes ? <div className="muted" style={{ fontSize: 12 }}>{detail.inspectionNotes}</div> : null}</span> : detail.type.requiresInspection ? "Not yet inspected" : "Not required"}</Descriptions.Item>
              <Descriptions.Item label="Fee">{formatMoney(detail.feeAmount, detail.currency)}{detail.paidAt ? <div className="muted" style={{ fontSize: 12 }}>Receipt {detail.receiptNo} · {formatDate(detail.paidAt)}</div> : <div style={{ fontSize: 12, color: "#b28600" }}>Unpaid</div>}</Descriptions.Item>
              <Descriptions.Item label="Valid from">{formatDate(detail.issuedAt) || "–"}</Descriptions.Item>
              <Descriptions.Item label="Valid until"><Expiry d={detail.expiresAt} /></Descriptions.Item>
              {detail.conditions && <Descriptions.Item label="Conditions" span={2}>{detail.conditions}</Descriptions.Item>}
              {detail.decisionNote && <Descriptions.Item label="Decision" span={2}>{detail.decisionNote}</Descriptions.Item>}
              {(detail.renewedFrom || detail.renewals.length > 0) && (
                <Descriptions.Item label="Renewals" span={2}>
                  {detail.renewedFrom && <div>Renews <a onClick={() => show(detail.renewedFrom!.id)} className="mono">{detail.renewedFrom.licenceNo || detail.renewedFrom.referenceNo}</a></div>}
                  {detail.renewals.map((r) => <div key={r.id}>Renewed by <a onClick={() => show(r.id)} className="mono">{r.licenceNo || r.referenceNo}</a> <StatusTag status={r.status} /></div>)}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Row gutter={24} style={{ marginTop: 24 }}>
              <Col xs={24} md={11}>
                <Typography.Title level={5}>Documents</Typography.Title>
                {!detail.documents?.length ? <Typography.Text type="secondary">No document requirements for this licence type.</Typography.Text> : (
                  <div>
                    {(docs || detail.documents).map((d, i) => (
                      <div key={d.name} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                        <Checkbox checked={d.received} onChange={(e) => setDocs((docs || detail.documents).map((x, j) => (j === i ? { ...x, received: e.target.checked } : x)))}>{d.name}</Checkbox>
                      </div>
                    ))}
                    <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{(docs || detail.documents).filter((d) => d.received).length} of {detail.documents.length} received</div>
                    {docs && <Space style={{ marginTop: 8 }}><Button type="primary" size="small" onClick={saveDocs}>Save checklist</Button><Button size="small" onClick={() => setDocs(null)}>Discard</Button></Space>}
                  </div>
                )}
                {detail.attachments && detail.attachments.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Typography.Text strong>Uploaded by the applicant</Typography.Text>
                    {detail.attachments.map((a) => <div key={a.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)" }}><a href={`/api/licence-attachments/${a.id}`}>{a.fileName}</a>{a.label && <span className="muted"> · {a.label}</span>}<span className="muted"> · {Math.max(1, Math.round(a.size / 1024))} KB · {formatDate(a.createdAt)}</span></div>)}
                  </div>
                )}
              </Col>
              <Col xs={24} md={13}>
                <Typography.Title level={5}>History</Typography.Title>
                <Timeline items={detail.events.map((e) => ({ color: e.kind === "REJECTED" || e.kind === "REVOKED" || e.kind === "SUSPENDED" ? "red" : e.kind === "ISSUED" || e.kind === "APPROVED" || e.kind === "PAID" ? "green" : e.kind === "NOTE" || e.kind === "DOCUMENT" ? "gray" : "blue", content: <div><div>{LICENCE_EVENT_LABELS[e.kind] || e.kind}{e.toStatus && e.fromStatus ? <span className="muted"> · {LICENCE_STATUS_LABELS[e.fromStatus as LicenceStatus] || e.fromStatus} → {LICENCE_STATUS_LABELS[e.toStatus as LicenceStatus] || e.toStatus}</span> : null}</div>{e.note && <div style={{ fontSize: 13 }}>{e.note}</div>}<div className="muted" style={{ fontSize: 12 }}>{e.actor?.name || "System"} · {formatDate(e.createdAt, true)}</div></div> })) } />
              </Col>
            </Row>
          </div>
        )}
      </Drawer>

      <Modal open={!!acting} onCancel={() => setActing(null)} onOk={run} title={acting ? LICENCE_ACTION_LABELS[acting] : ""} okText={acting ? LICENCE_ACTION_LABELS[acting] : "OK"} okButtonProps={{ danger: !!acting && ["reject", "revoke", "suspend", "cancel"].includes(acting) }} destroyOnHidden zIndex={1100}>
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 12 }}>
          {acting === "schedule_inspection" && (<>
            <Form.Item name="inspectorId" label="Inspector" rules={[{ required: true }]} initialValue={me?.user.id}><Select showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>
            <Form.Item name="inspectionDue" label="Inspection due by" initialValue={dayjs().add(5, "day")}><DatePicker style={{ width: "100%" }} /></Form.Item>
          </>)}
          {acting === "record_inspection" && (<>
            <Form.Item name="outcome" label="Outcome" rules={[{ required: true, message: "Choose the outcome" }]}><Radio.Group options={[{ value: "PASS", label: "Passed: premises comply" }, { value: "CONDITIONAL", label: "Passed with conditions" }, { value: "FAIL", label: "Failed: does not comply" }]} optionType="button" /></Form.Item>
            <Form.Item noStyle shouldUpdate>{() => form.getFieldValue("outcome") === "CONDITIONAL" && <Form.Item name="conditions" label="Conditions to attach to the licence" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>}</Form.Item>
          </>)}
          {acting === "approve" && <Form.Item name="conditions" label="Conditions (optional)" initialValue={detail?.conditions || undefined}><Input.TextArea rows={3} placeholder="e.g. Trading hours 07:00–19:00; no sale of alcohol" /></Form.Item>}
          {acting === "pay" && (<>
            <Form.Item name="receiptNo" label="Receipt number" rules={[{ required: true }]}><Input placeholder="e.g. RC-004512" /></Form.Item>
            <Form.Item name="amount" label="Amount received" initialValue={detail?.feeAmount}><InputNumber min={0} style={{ width: "100%" }} prefix={detail?.currency} /></Form.Item>
            <Form.Item name="paidAt" label="Date paid" initialValue={dayjs()}><DatePicker style={{ width: "100%" }} /></Form.Item>
          </>)}
          {acting === "issue" && (<>
            {!detail?.paidAt && <Form.Item name="receiptNo" label="Receipt number (fee not yet recorded)" rules={[{ required: true }]}><Input /></Form.Item>}
            <Form.Item name="issuedAt" label="Valid from" initialValue={dayjs()}><DatePicker style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="validityMonths" label="Validity (months)" initialValue={detail?.type.validityMonths}><InputNumber min={1} max={600} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="conditions" label="Conditions printed on the certificate" initialValue={detail?.conditions || undefined}><Input.TextArea rows={2} /></Form.Item>
          </>)}
          {acting === "renew" && <Typography.Paragraph>A new application linked to <span className="mono">{detail?.licenceNo || detail?.referenceNo}</span> is opened with the applicant&apos;s details copied and the current fee of {formatMoney(detail?.feeAmount, detail?.currency)}. The existing licence stays on record.</Typography.Paragraph>}
          {acting && !["renew", "document"].includes(acting) && (
            <Form.Item name="note" label={["reject", "revoke", "suspend"].includes(acting) ? "Reason (shown to the officer and on the record)" : "Note"} rules={[{ required: ["reject", "revoke", "suspend", "note"].includes(acting), message: "Required" }]}><Input.TextArea rows={3} /></Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default function LicencesPage() {
  return <Suspense fallback={<Skeleton active />}><Licences /></Suspense>;
}
