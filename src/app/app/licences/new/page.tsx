"use client";

import { App, Button, Card, Checkbox, Col, Descriptions, Divider, Form, Input, Row, Select, Space, Typography } from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DynamicFields, defaultsFor } from "@/components/DynamicForm";
import { PriorityTag } from "@/components/StatusTag";
import { api, formatMoney, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";
import { APPLICATION_KIND_LABELS, type ApplicationKind } from "@/lib/licenceTypes";
import type { FieldDef } from "@/lib/types";

interface LType { id: string; code: string; name: string; category: string; description?: string | null; fee: number; currency: string; validityMonths: number; requiresInspection: boolean; requirements: string[]; department?: { name: string } | null; formTitle?: string | null; legalBasis?: string | null; instructions?: string | null; fields: FieldDef[]; officeFields: FieldDef[]; kinds: string[] }

const WARDS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const STANDARD_KEYS = new Set(["typeId", "applicationKind", "applicantName", "tradingName", "idNumber", "phone", "email", "standNumber", "address", "ward", "activity", "priority", "officerId"]);

/** Log a licence application received over the counter, by post or by email, on the licence type's own form. */
export default function NewLicencePage() {
  const { message } = App.useApp();
  const router = useRouter();
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const { data: types } = useApi<LType[]>("/api/licence-types");
  const { data: users } = useApi<{ id: string; name: string }[]>(isManager ? "/api/users?active=1" : null);
  const [form] = Form.useForm();
  const [typeId, setTypeId] = useState<string>();
  const [received, setReceived] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const type = (types || []).find((t) => t.id === typeId);
  const officeKeys = new Set((type?.officeFields || []).map((f) => f.key));

  const submit = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const standard: Record<string, unknown> = {}; const data: Record<string, unknown> = {}; const officeData: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) { if (STANDARD_KEYS.has(k)) standard[k] = val; else if (officeKeys.has(k) || (k.endsWith("Total") && officeKeys.has(k.slice(0, -5)))) officeData[k] = val; else data[k] = val; }
      const documents = (type?.requirements || []).map((name) => ({ name, received: !!received[name] }));
      const l = await api<{ id: string; referenceNo: string }>("/api/licences", { method: "POST", json: { ...standard, data, officeData, documents } });
      message.success(`Application ${l.referenceNo} logged`);
      router.push(`/app/licences?open=${l.id}`);
    } catch (e) { message.error((e as Error).message); } finally { setSaving(false); }
  };

  const choose = (id: string) => {
    const t = (types || []).find((x) => x.id === id);
    setTypeId(id); setReceived({});
    if (t) form.setFieldsValue({ ...defaultsFor(t.fields || []), ...defaultsFor(t.officeFields || []), applicationKind: t.kinds?.[0] || "NEW" });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/app/licences" className="muted" style={{ fontSize: 13 }}><ArrowLeftOutlined /> Licensing</Link>
          <Typography.Title level={3} className="page-title" style={{ marginTop: 4 }}>New licence application</Typography.Title>
          <Typography.Text type="secondary">Capture the paper form as handed in at the counter. The questions, fee, validity and document checklist come from the licence type.</Typography.Text>
        </div>
      </div>
      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card>
            <Form form={form} layout="vertical" onFinish={submit} initialValues={{ priority: "MEDIUM" }}>
              <Row gutter={16}>
                <Col xs={24} md={14}>
                  <Form.Item name="typeId" label="Licence type" rules={[{ required: true, message: "Choose the licence applied for" }]}>
                    <Select showSearch optionFilterProp="label" placeholder="Choose" onChange={choose}
                      options={Object.entries((types || []).reduce<Record<string, LType[]>>((acc, t) => { (acc[t.category] ||= []).push(t); return acc; }, {})).map(([cat, list]) => ({ label: cat, options: list.map((t) => ({ value: t.id, label: `${t.name} · ${formatMoney(t.fee, t.currency)} · ${t.validityMonths} months` })) }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item name="applicationKind" label="Type of application" rules={[{ required: true }]}>
                    <Select disabled={!type} options={(type?.kinds || ["NEW"]).map((k) => ({ value: k, label: APPLICATION_KIND_LABELS[k as ApplicationKind] || k }))} />
                  </Form.Item>
                </Col>
              </Row>
              {type?.formTitle && <Typography.Title level={4} style={{ marginTop: 0 }}>{type.formTitle}{type.legalBasis && <div className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{type.legalBasis}</div>}</Typography.Title>}
              <Typography.Title level={5}>Particulars of applicant</Typography.Title>
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item name="applicantName" label="Full name of applicant" rules={[{ required: true, min: 2 }]} extra="As on the national ID or company registration. For a company, co-operative or partnership attach the schedule of directors, committee members or partners."><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="tradingName" label="Name under which the trade or business is or will be conducted"><Input placeholder="e.g. Zengeza Fresh Grocers" /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="idNumber" label="National ID / company number"><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="phone" label="Telephone" rules={[{ required: true, message: "A phone number is needed for follow-up" }]}><Input placeholder="07xx xxx xxx" /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="email" label="Email" rules={[{ type: "email" }]}><Input /></Form.Item></Col>
              </Row>
              <Typography.Title level={5}>Situation of the premises</Typography.Title>
              <Row gutter={16}>
                <Col xs={24} md={8}><Form.Item name="standNumber" label="Stand number"><Input placeholder="e.g. 1234 Zengeza 4" /></Form.Item></Col>
                <Col xs={24} md={10}><Form.Item name="address" label="Street / physical address"><Input /></Form.Item></Col>
                <Col xs={24} md={6}><Form.Item name="ward" label="Ward"><Select allowClear options={WARDS.map((w) => ({ value: w, label: `Ward ${w}` }))} /></Form.Item></Col>
                <Col xs={24}><Form.Item name="activity" label="Describe the trade, business or purpose" rules={[{ required: true, message: "Describe the activity to be licensed" }]}><Input.TextArea rows={3} placeholder="e.g. Retail of groceries and household goods; 2 employees; trading 07:00–20:00" /></Form.Item></Col>
              </Row>
              {type && type.fields?.length > 0 && <DynamicFields fields={type.fields} currency={type.currency} />}
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col xs={24} md={8}><Form.Item name="priority" label="Priority" extra="Use High for enforcement cases or time-bound events"><Select options={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => ({ value: p, label: <PriorityTag priority={p} /> }))} /></Form.Item></Col>
                {isManager && <Col xs={24} md={8}><Form.Item name="officerId" label="Handling officer" initialValue={me?.user.id}><Select showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item></Col>}
              </Row>
              {type && type.requirements.length > 0 && (
                <>
                  <Typography.Title level={5}>Documents handed in</Typography.Title>
                  <div style={{ marginBottom: 16 }}>
                    {type.requirements.map((r) => <div key={r} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}><Checkbox checked={!!received[r]} onChange={(e) => setReceived((x) => ({ ...x, [r]: e.target.checked }))}>{r}</Checkbox></div>)}
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Missing documents can be ticked off later from the licence record.</div>
                  </div>
                </>
              )}
              {type && type.officeFields?.length > 0 && (
                <>
                  <Divider />
                  <Typography.Title level={5}>For office use only</Typography.Title>
                  <DynamicFields fields={type.officeFields} currency={type.currency} />
                </>
              )}
              {type?.instructions && <Typography.Paragraph type="secondary" style={{ fontSize: 12, whiteSpace: "pre-line", marginTop: 8 }}>{type.instructions}</Typography.Paragraph>}
              <Space>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>Log application</Button>
                <Link href="/app/licences"><Button>Cancel</Button></Link>
              </Space>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={type ? type.name : "Licence details"}>
            {!type ? <Typography.Text type="secondary">Choose a licence type to see the fee, validity, inspection requirement and the documents the applicant must supply.</Typography.Text> : (
              <>
                {type.description && <Typography.Paragraph>{type.description}</Typography.Paragraph>}
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Code">{type.code}</Descriptions.Item>
                  {type.legalBasis && <Descriptions.Item label="Made under">{type.legalBasis}</Descriptions.Item>}
                  <Descriptions.Item label="Fee">{formatMoney(type.fee, type.currency)}</Descriptions.Item>
                  <Descriptions.Item label="Validity">{type.validityMonths} months</Descriptions.Item>
                  <Descriptions.Item label="Inspection">{type.requiresInspection ? "Required before approval" : "Not required"}</Descriptions.Item>
                  {type.department && <Descriptions.Item label="Department">{type.department.name}</Descriptions.Item>}
                </Descriptions>
                <Typography.Text strong>Process</Typography.Text>
                <ol style={{ paddingLeft: 18, margin: "6px 0 0", fontSize: 13 }}>
                  <li>Application logged (this form)</li>
                  <li>Review of documents</li>
                  {type.requiresInspection && <li>Site inspection by the department</li>}
                  <li>Approval by the head of department</li>
                  <li>Fee paid; Finance confirms the payment</li>
                  <li>Licence issued and certificate printed</li>
                </ol>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
