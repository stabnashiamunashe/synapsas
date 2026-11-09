"use client";

import { Alert, App, Button, Card, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import { NotificationOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { api, formatDate, useApi, useMe } from "@/lib/client";
import { STAT_TOPICS } from "@/lib/whatsapp/i18n";

type Kind = "indicators" | "releases" | "subscriptions" | "surveys" | "officers";
interface Indicator { id: string; topic: string; name: string; value: string; period?: string | null; releaseDate?: string | null; url?: string | null; note?: string | null; sortOrder: number; isActive: boolean; updatedAt: string }
interface Release { id: string; title: string; topic: string; scheduledAt: string; url?: string | null; summary?: string | null; publishedAt?: string | null; notifiedAt?: string | null }
interface Subscription { id: string; phone: string; topics: string; frequency: string; language: string; isActive: boolean; createdAt: string; lastSentAt?: string | null }
interface Survey { id: string; code: string; name: string; description?: string | null; areas?: string | null; startsOn?: string | null; endsOn?: string | null; isActive: boolean; _count: { officers: number } }
interface Officer { id: string; badgeNo: string; name: string; role?: string | null; area?: string | null; validFrom?: string | null; validTo?: string | null; isActive: boolean; survey?: { id: string; name: string; code: string } | null }
interface Category { id: string; name: string; department?: { name: string } | null }

const topicOptions = STAT_TOPICS.map((t) => ({ value: t.key, label: t.en }));
const topicName = (k: string) => STAT_TOPICS.find((t) => t.key === k)?.en || k;
const D = (v?: string | null) => (v ? dayjs(v) : null);
const S = (v?: dayjs.Dayjs | null) => (v ? v.format("YYYY-MM-DD") : null);

/** Generic editor: list + add/edit modal for one content kind. */
function Editor<T extends { id: string }>({ kind, title, intro, columns, fields, toForm, fromForm, extra, rowClassName }: {
  kind: Kind; title: string; intro: string; columns: NonNullable<Parameters<typeof Table<T>>[0]["columns"]>; fields: React.ReactNode; toForm: (r: T) => Record<string, unknown>; fromForm: (v: Record<string, unknown>) => Record<string, unknown>;
  extra?: (r: T, refresh: () => void) => React.ReactNode; rowClassName?: (r: T) => string;
}) {
  const { message } = App.useApp();
  const [q, setQ] = useState("");
  const { data, isLoading, mutate } = useApi<T[]>(`/api/chatbot/${kind}${kind === "officers" && q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [form] = Form.useForm();
  const open = (r: T | "new") => { setEditing(r); form.resetFields(); if (r !== "new") form.setFieldsValue(toForm(r)); else form.setFieldsValue({ isActive: true }); };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing === "new") await api(`/api/chatbot/${kind}`, { method: "POST", json: fromForm(v) });
      else if (editing) await api(`/api/chatbot/${kind}/${editing.id}`, { method: "PATCH", json: fromForm(v) });
      setEditing(null); mutate(); message.success("Saved");
    } catch (e) { message.error((e as Error).message); }
  };
  const remove = async (r: T) => { try { await api(`/api/chatbot/${kind}/${r.id}`, { method: "DELETE" }); mutate(); } catch (e) { message.error((e as Error).message); } };
  return (
    <Card title={title} extra={<Space>{kind === "officers" && <Input allowClear prefix={<SearchOutlined />} placeholder="Badge or name" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />}{kind !== "subscriptions" && <Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>Add</Button>}</Space>}>
      <Typography.Paragraph type="secondary">{intro}</Typography.Paragraph>
      <Table<T> rowKey="id" size="small" loading={isLoading} dataSource={data || []} pagination={{ pageSize: 20, hideOnSinglePage: true }} rowClassName={rowClassName} scroll={{ x: 800 }} columns={[...columns, { title: "", width: kind === "releases" ? 230 : 130, align: "right", render: (_: unknown, r: T) => <Space size={4}>{extra?.(r, mutate)}{kind !== "subscriptions" && <Button size="small" onClick={() => open(r)}>Edit</Button>}<Popconfirm title="Delete this entry?" onConfirm={() => remove(r)}><Button size="small" danger>Delete</Button></Popconfirm></Space> }]} />
      <Modal open={!!editing} title={editing === "new" ? `Add ${title.toLowerCase().replace(/s$/, "")}` : "Edit"} onCancel={() => setEditing(null)} onOk={save} okText="Save" width={640} destroyOnHidden>
        <Form form={form} layout="vertical">{fields}</Form>
      </Modal>
    </Card>
  );
}

function Routing() {
  const { message } = App.useApp();
  const { data: me, mutate } = useMe();
  const { data: cats } = useApi<Category[]>("/api/case-categories");
  const wa = me?.org.settings.cases?.whatsapp || {};
  const [form] = Form.useForm();
  const save = async (v: Record<string, unknown>) => {
    if (!me) return;
    try { await api("/api/org", { method: "PATCH", json: { settings: { ...me.org.settings, cases: { ...(me.org.settings.cases || {}), whatsapp: { ...wa, ...v } } } } }); mutate(); message.success("Saved"); } catch (e) { message.error((e as Error).message); }
  };
  const catOpts = (cats || []).map((c) => ({ value: c.id, label: `${c.name}${c.department ? ` · ${c.department.name}` : ""}` }));
  if (!me) return null;
  return (
    <Card title="Routing and options">
      <Typography.Paragraph type="secondary">Where each WhatsApp submission lands in the service desk, the Open Data Portal link the bot quotes, and which menu options are switched on for the phased rollout. Greeting and help text are under <Link href="/app/settings/whatsapp">WhatsApp channel</Link>.</Typography.Paragraph>
      <Form form={form} layout="vertical" initialValues={{ dataRequestCategoryId: wa.dataRequestCategoryId, verificationCategoryId: wa.verificationCategoryId, liveChatCategoryId: wa.liveChatCategoryId, erasureCategoryId: wa.erasureCategoryId, odpUrl: wa.odpUrl, officeHoursNote: wa.officeHoursNote, enabled: ["stats", "data", "verify", "alerts", "enquiry", "chat"].filter((k) => !(wa.disabledOptions || []).includes(k as never)) }} onFinish={(v) => save({ ...v, enabled: undefined, disabledOptions: ["stats", "data", "verify", "alerts", "enquiry", "chat"].filter((k) => !v.enabled.includes(k)) })}>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="dataRequestCategoryId" label="Data requests (DR-) go to" extra="Dissemination queue"><Select allowClear showSearch optionFilterProp="label" options={catOpts} /></Form.Item></Col>
          <Col span={12}><Form.Item name="verificationCategoryId" label="Field verification concerns (VR-) go to" extra="Field Operations queue"><Select allowClear showSearch optionFilterProp="label" options={catOpts} /></Form.Item></Col>
          <Col span={12}><Form.Item name="liveChatCategoryId" label="Live chats are filed under" extra="Blank: the topic the user picked"><Select allowClear showSearch optionFilterProp="label" options={catOpts} /></Form.Item></Col>
          <Col span={12}><Form.Item name="erasureCategoryId" label="'Delete my data' requests go to"><Select allowClear showSearch optionFilterProp="label" options={catOpts} /></Form.Item></Col>
          <Col span={12}><Form.Item name="odpUrl" label="Open Data Portal (ODP 2.0) link"><Input placeholder="https://data.zimstat.co.zw" /></Form.Item></Col>
          <Col span={12}><Form.Item name="officeHoursNote" label="Office hours wording for live chat" extra="Blank: built from Settings → Organisation working hours"><Input placeholder="Monday to Friday, 08:00 to 16:30" /></Form.Item></Col>
          <Col span={24}><Form.Item name="enabled" label="Menu options switched on"><Checkbox.Group options={[{ value: "stats", label: "1 Latest statistics" }, { value: "data", label: "2 Data requests" }, { value: "verify", label: "3 Verify officer / survey" }, { value: "alerts", label: "4 Release calendar & alerts" }, { value: "enquiry", label: "5 Enquiries & complaints" }, { value: "chat", label: "6 Talk to an officer" }]} /></Form.Item></Col>
        </Row>
        <Button type="primary" htmlType="submit">Save</Button>
      </Form>
    </Card>
  );
}

export default function ChatbotContentPage() {
  const { message } = App.useApp();
  const { data: surveys } = useApi<Survey[]>("/api/chatbot/surveys");
  const publish = async (r: Release, refresh: () => void) => {
    try { const res = await api<{ sent: number }>(`/api/chatbot/releases/${r.id}`, { method: "PATCH", json: { action: "publish" } }); refresh(); message.success(`Published. ${res.sent} subscriber${res.sent === 1 ? "" : "s"} alerted.`); } catch (e) { message.error((e as Error).message); }
  };
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Chatbot content</Typography.Title>
          <div className="muted">What the WhatsApp bot answers from. Look-ups (statistics, verification, calendar) come straight from these tables; data requests, concerns, enquiries and live chats become DR-, VR- and TK- cases in the service desk.</div>
        </div>
        <Link href="/app/settings/whatsapp"><Button>WhatsApp channel & sandbox</Button></Link>
      </div>
      <Alert type="info" showIcon title="Sample figures" description="The seeded statistics are placeholders. Update every indicator with the latest published figure and ODP 2.0 link before the public pilot; the bot quotes exactly what is here." />
      <Tabs items={[
        { key: "stats", label: "Headline statistics", children: (
          <Editor<Indicator> kind="indicators" title="Indicators" intro="Option 1. Topic → indicator → the latest published figure with its reference period, release date and link. Keep one row per indicator and overwrite the value on each release."
            columns={[
              { title: "Topic", width: 190, render: (_, r) => topicName(r.topic) },
              { title: "Indicator", render: (_, r) => <span>{r.name}{r.note ? <div className="muted" style={{ fontSize: 12 }}>{r.note}</div> : null}</span> },
              { title: "Latest value", width: 180, render: (_, r) => <b>{r.value}</b> },
              { title: "Period", width: 150, render: (_, r) => r.period || "–" },
              { title: "Released", width: 110, render: (_, r) => formatDate(r.releaseDate) || "–" },
              { title: "Link", width: 70, render: (_, r) => r.url ? <a href={r.url} target="_blank" rel="noreferrer">ODP</a> : "–" },
              { title: "", width: 70, render: (_, r) => r.isActive ? <Tag color="green">live</Tag> : <Tag>hidden</Tag> },
            ]}
            fields={<Row gutter={12}>
              <Col span={10}><Form.Item name="topic" label="Topic" rules={[{ required: true }]}><Select options={topicOptions} /></Form.Item></Col>
              <Col span={14}><Form.Item name="name" label="Indicator" rules={[{ required: true }]}><Input placeholder="Year-on-year inflation" /></Form.Item></Col>
              <Col span={8}><Form.Item name="value" label="Latest value" rules={[{ required: true }]}><Input placeholder="3.1%" /></Form.Item></Col>
              <Col span={8}><Form.Item name="period" label="Reference period"><Input placeholder="September 2026" /></Form.Item></Col>
              <Col span={8}><Form.Item name="releaseDate" label="Release date"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
              <Col span={16}><Form.Item name="url" label="ODP 2.0 link"><Input /></Form.Item></Col>
              <Col span={4}><Form.Item name="sortOrder" label="Order"><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
              <Col span={4}><Form.Item name="isActive" label="Live" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col span={24}><Form.Item name="note" label="Note (shown under the figure)"><Input /></Form.Item></Col>
            </Row>}
            toForm={(r) => ({ ...r, releaseDate: D(r.releaseDate) })} fromForm={(v) => ({ ...v, releaseDate: S(v.releaseDate as dayjs.Dayjs | null) })} />
        ) },
        { key: "releases", label: "Release calendar & alerts", children: (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Editor<Release> kind="releases" title="Scheduled releases" intro="Option 4. The bot shows the next five dates. When a release is out, press Publish: subscribers to that topic are alerted on WhatsApp (plain message inside their 24-hour window, otherwise the release template)."
              rowClassName={(r) => (r.publishedAt ? "muted" : "")}
              columns={[
                { title: "Date", width: 110, render: (_, r) => formatDate(r.scheduledAt) },
                { title: "Release", render: (_, r) => <span>{r.title}{r.summary ? <div className="muted" style={{ fontSize: 12 }}>{r.summary}</div> : null}</span> },
                { title: "Topic", width: 190, render: (_, r) => topicName(r.topic) },
                { title: "Status", width: 150, render: (_, r) => r.notifiedAt ? <Tag color="green">published · alerts sent</Tag> : r.publishedAt ? <Tag color="blue">published</Tag> : <Tag>scheduled</Tag> },
              ]}
              extra={(r, refresh) => !r.notifiedAt && <Popconfirm title="Mark as published and alert subscribers?" onConfirm={() => publish(r, refresh)}><Button size="small" type="primary" icon={<NotificationOutlined />}>Publish</Button></Popconfirm>}
              fields={<Row gutter={12}>
                <Col span={16}><Form.Item name="title" label="Title" rules={[{ required: true }]}><Input placeholder="Consumer Price Index, October 2026" /></Form.Item></Col>
                <Col span={8}><Form.Item name="topic" label="Topic" rules={[{ required: true }]}><Select options={topicOptions} /></Form.Item></Col>
                <Col span={8}><Form.Item name="scheduledAt" label="Release date" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
                <Col span={16}><Form.Item name="url" label="Link"><Input /></Form.Item></Col>
                <Col span={24}><Form.Item name="summary" label="One-line summary sent with the alert"><Input /></Form.Item></Col>
              </Row>}
              toForm={(r) => ({ ...r, scheduledAt: D(r.scheduledAt) })} fromForm={(v) => ({ ...v, scheduledAt: S(v.scheduledAt as dayjs.Dayjs | null) })} />
            <Editor<Subscription> kind="subscriptions" title="Alert subscribers" intro="Numbers that asked for release alerts (masked). People unsubscribe themselves by typing 'stop alerts'; delete here only on request."
              columns={[
                { title: "Number", width: 160, render: (_, r) => <span className="mono">{r.phone}</span> },
                { title: "Topics", render: (_, r) => { const ts = JSON.parse(r.topics || "[]") as string[]; return ts.length ? ts.map(topicName).join(", ") : "All topics"; } },
                { title: "Frequency", width: 130, render: (_, r) => r.frequency === "EVERY" ? "Every release" : "Monthly summary" },
                { title: "Language", width: 90, render: (_, r) => r.language },
                { title: "Since", width: 110, render: (_, r) => formatDate(r.createdAt) },
                { title: "", width: 80, render: (_, r) => r.isActive ? <Tag color="green">active</Tag> : <Tag>stopped</Tag> },
              ]}
              fields={null} toForm={(r) => ({ ...r })} fromForm={(v) => v} />
          </Space>
        ) },
        { key: "field", label: "Field verification", children: (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Editor<Officer> kind="officers" title="Field-staff register" intro="Option 3. The badge ID a household types is checked against active officers within their validity dates. Keep this list current: deactivate officers when a survey ends."
              rowClassName={(r) => (r.isActive ? "" : "muted")}
              columns={[
                { title: "Badge ID", width: 140, render: (_, r) => <span className="mono"><b>{r.badgeNo}</b></span> },
                { title: "Name", render: (_, r) => <span>{r.name}<div className="muted" style={{ fontSize: 12 }}>{r.role || "Enumerator"}</div></span> },
                { title: "Survey", width: 220, render: (_, r) => r.survey ? `${r.survey.name}` : <span className="muted">–</span> },
                { title: "Area", width: 220, render: (_, r) => r.area || "–" },
                { title: "Valid", width: 180, render: (_, r) => `${formatDate(r.validFrom) || "…"} – ${formatDate(r.validTo) || "…"}` },
                { title: "", width: 80, render: (_, r) => r.isActive ? <Tag color="green">active</Tag> : <Tag>inactive</Tag> },
              ]}
              fields={<Row gutter={12}>
                <Col span={8}><Form.Item name="badgeNo" label="Badge ID" rules={[{ required: true }]}><Input placeholder="ZS-ENU-1042" /></Form.Item></Col>
                <Col span={16}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="role" label="Role"><Input placeholder="Enumerator" /></Form.Item></Col>
                <Col span={16}><Form.Item name="surveyId" label="Survey"><Select allowClear options={(surveys || []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))} /></Form.Item></Col>
                <Col span={24}><Form.Item name="area" label="Deployment area"><Input placeholder="Harare Province, Epworth and Chitungwiza" /></Form.Item></Col>
                <Col span={8}><Form.Item name="validFrom" label="Valid from"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="validTo" label="Valid to"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item></Col>
              </Row>}
              toForm={(r) => ({ ...r, surveyId: r.survey?.id, validFrom: D(r.validFrom), validTo: D(r.validTo) })} fromForm={(v) => ({ ...v, survey: undefined, validFrom: S(v.validFrom as dayjs.Dayjs | null), validTo: S(v.validTo as dayjs.Dayjs | null) })} />
            <Editor<Survey> kind="surveys" title="Surveys in the field" intro="What the bot confirms when someone asks whether a survey is genuine: name, period, areas and what respondents will be asked."
              rowClassName={(r) => (r.isActive ? "" : "muted")}
              columns={[
                { title: "Code", width: 140, render: (_, r) => <span className="mono">{r.code}</span> },
                { title: "Survey", render: (_, r) => <span>{r.name}{r.description ? <div className="muted" style={{ fontSize: 12 }}>{r.description.slice(0, 140)}</div> : null}</span> },
                { title: "Period", width: 200, render: (_, r) => `${formatDate(r.startsOn) || "…"} – ${formatDate(r.endsOn) || "…"}` },
                { title: "Officers", width: 80, align: "center", render: (_, r) => r._count.officers },
                { title: "", width: 80, render: (_, r) => r.isActive ? <Tag color="green">in field</Tag> : <Tag>ended</Tag> },
              ]}
              fields={<Row gutter={12}>
                <Col span={8}><Form.Item name="code" label="Code" rules={[{ required: true }]}><Input placeholder="ZDHS-2026" /></Form.Item></Col>
                <Col span={16}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={24}><Form.Item name="areas" label="Areas covered"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="startsOn" label="Starts"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="endsOn" label="Ends"><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="isActive" label="In the field" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={24}><Form.Item name="description" label="What respondents will be asked"><Input.TextArea autoSize={{ minRows: 3 }} /></Form.Item></Col>
              </Row>}
              toForm={(r) => ({ ...r, startsOn: D(r.startsOn), endsOn: D(r.endsOn) })} fromForm={(v) => ({ ...v, _count: undefined, startsOn: S(v.startsOn as dayjs.Dayjs | null), endsOn: S(v.endsOn as dayjs.Dayjs | null) })} />
          </Space>
        ) },
        { key: "routing", label: "Routing & options", children: <Routing /> },
      ]} />
    </Space>
  );
}
