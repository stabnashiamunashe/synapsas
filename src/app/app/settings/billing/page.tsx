"use client";

import { Alert, App, Button, Card, Col, Descriptions, Input, Modal, Popconfirm, Progress, Radio, Row, Segmented, Skeleton, Space, Statistic, Table, Tag, Typography } from "antd";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, formatDate, useApi, useMe } from "@/lib/client";
import type { PlanLimits } from "@/lib/plans";

interface Status {
  entitlements: { plan: string; subscribedPlan: string; status: string; locked: boolean; trialDaysLeft: number | null; graceDaysLeft: number | null; renewsAt: string | null; limits: PlanLimits; banner: { level: "info" | "warning" | "error"; text: string } | null };
  subscription: { plan: string; status: string; cycle: string; renewsAt: string | null; trialEndsAt: string | null; graceEndsAt: string | null; cancelAtPeriodEnd: boolean; provider: string | null; billingEmail: string | null; hasPortal: boolean };
  usage: { users: number; templates: number; requestsThisMonth: number; storageMb: number };
  over: { users: boolean; templates: boolean; requests: boolean };
  openInvoice: Invoice | null;
  provider: { provider: "stripe" | "paynow" | "manual"; ready: boolean; reason?: string };
  currency: string;
  plans: Record<string, PlanLimits>;
  pricing: { yearlyMonths: number; trialDays: number };
}
interface Invoice { id: string; number: string; plan: string; cycle: string; amountCents: number; currency: string; status: string; provider: string; providerRef?: string | null; checkoutUrl?: string | null; description?: string | null; periodStart: string; periodEnd: string; dueAt?: string | null; paidAt?: string | null; createdAt: string; meta: { instructions?: string; reason?: string } }

const pct = (used: number, limit: number) => (limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100)));
const lim = (n: number) => (n === -1 ? "∞" : n);
const STATUS_COLOR: Record<string, string> = { TRIALING: "blue", ACTIVE: "green", PAST_DUE: "red", CANCELLED: "default", EXPIRED: "orange", FREE: "default", PENDING: "orange", PAID: "green", FAILED: "red", VOID: "default" };
const PROVIDER_LABEL = { stripe: "Card (Stripe)", paynow: "Paynow · EcoCash / OneMoney / card", manual: "Bank transfer" };

function Billing() {
  const { message } = App.useApp();
  const params = useSearchParams();
  const { data, mutate } = useApi<Status>("/api/billing/status");
  const { data: invoices, mutate: mutateInv } = useApi<Invoice[]>("/api/billing/invoices");
  const { data: me, mutate: mutateMe } = useMe();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [choosing, setChoosing] = useState<string | null>(null);
  const [method, setMethod] = useState<"card" | "mobile">("card");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ instructions?: string | null; invoice?: Invoice } | null>(null);
  if (!data) return <Skeleton active />;
  const isOwner = me?.user.role === "OWNER";
  const { entitlements: ent, subscription: sub, usage, over } = data;
  const price = (p: PlanLimits) => (cycle === "yearly" ? p.priceMonthly * data.pricing.yearlyMonths : p.priceMonthly);

  const checkout = async () => {
    if (!choosing) return;
    setBusy(true);
    try {
      const r = await api<{ checkoutUrl: string | null; instructions: string | null; invoice: Invoice }>("/api/billing/checkout", { method: "POST", json: { plan: choosing, cycle, method: data.provider.provider === "paynow" ? method : undefined, phone: method === "mobile" ? phone : undefined } });
      if (r.checkoutUrl) { window.location.href = r.checkoutUrl; return; }
      setResult({ instructions: r.instructions, invoice: r.invoice });
      setChoosing(null);
      mutate(); mutateInv();
    } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
  };
  const cancel = async () => {
    try { await api("/api/billing/cancel", { method: "POST" }); message.success("Subscription will end at the period close"); mutate(); mutateMe(); } catch (e) { message.error((e as Error).message); }
  };
  const portal = async () => {
    try { const r = await api<{ url: string }>("/api/billing/portal", { method: "POST" }); window.location.href = r.url; } catch (e) { message.error((e as Error).message); }
  };

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      {params.get("paid") && <Alert type="success" showIcon title="Thank you. Your payment is being confirmed; the plan activates automatically once the provider reports it." />}
      {params.get("cancelled") && <Alert type="info" showIcon title="Checkout was cancelled. Nothing was charged." />}
      {ent.banner && <Alert type={ent.banner.level} showIcon title={ent.banner.text} />}
      {!data.provider.ready && isOwner && <Alert type="warning" showIcon title={`Online payments are not configured (${data.provider.reason}). Set BILLING_PROVIDER and the provider keys in the environment.`} />}

      <Card title={<Space>Subscription <Tag color={STATUS_COLOR[ent.status]}>{ent.status.replace("_", " ")}</Tag></Space>}
        extra={isOwner && ent.status === "ACTIVE" && !sub.cancelAtPeriodEnd && (
          <Space>
            {sub.hasPortal && <Button onClick={portal}>Manage card & receipts</Button>}
            <Popconfirm title="Cancel at the end of the current period?" onConfirm={cancel}><Button danger>Cancel subscription</Button></Popconfirm>
          </Space>
        )}>
        <Descriptions column={{ xs: 1, md: 3 }} size="small" items={[
          { key: "p", label: "Plan in effect", children: <b>{data.plans[ent.plan].name}</b> },
          { key: "s", label: ent.status === "TRIALING" ? "Trial ends" : ent.status === "PAST_DUE" ? "Read-only from" : sub.cancelAtPeriodEnd ? "Access ends" : "Renews", children: ent.status === "TRIALING" ? `${formatDate(sub.trialEndsAt)} (${ent.trialDaysLeft} days)` : ent.status === "PAST_DUE" ? formatDate(sub.graceEndsAt) : sub.renewsAt ? formatDate(sub.renewsAt) : "–" },
          { key: "c", label: "Billing", children: `${sub.cycle} · ${sub.provider ? PROVIDER_LABEL[sub.provider as keyof typeof PROVIDER_LABEL] || sub.provider : PROVIDER_LABEL[data.provider.provider]} · ${sub.billingEmail || "no billing email"}` },
        ]} />
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={12} md={6}><Statistic title="Users" value={usage.users} suffix={`/ ${lim(ent.limits.users)}`} styles={{ content: { color: over.users ? "#c53030" : undefined } }} /><Progress percent={pct(usage.users, ent.limits.users)} showInfo={false} size="small" status={over.users ? "exception" : undefined} /></Col>
          <Col xs={12} md={6}><Statistic title="Workflows" value={usage.templates} suffix={`/ ${lim(ent.limits.templates)}`} styles={{ content: { color: over.templates ? "#c53030" : undefined } }} /><Progress percent={pct(usage.templates, ent.limits.templates)} showInfo={false} size="small" status={over.templates ? "exception" : undefined} /></Col>
          <Col xs={12} md={6}><Statistic title="Requests this month" value={usage.requestsThisMonth} suffix={`/ ${lim(ent.limits.requestsPerMonth)}`} /><Progress percent={pct(usage.requestsThisMonth, ent.limits.requestsPerMonth)} showInfo={false} size="small" status={over.requests ? "exception" : undefined} /></Col>
          <Col xs={12} md={6}><Statistic title="Storage (MB)" value={usage.storageMb} suffix={`/ ${ent.limits.storageMb}`} /><Progress percent={pct(usage.storageMb, ent.limits.storageMb)} showInfo={false} size="small" /></Col>
        </Row>
        {(over.users || over.templates) && <Alert style={{ marginTop: 12 }} type="warning" showIcon title="You are above the limits of the plan in effect. Existing data is kept, but you cannot add users or workflows until you upgrade or reduce usage." />}
      </Card>

      {data.openInvoice && (
        <Card title={<Space>Outstanding invoice <Tag color="orange">{data.openInvoice.number}</Tag></Space>}>
          <Typography.Paragraph>{data.openInvoice.description} — <b>{data.openInvoice.currency} {(data.openInvoice.amountCents / 100).toFixed(2)}</b>{data.openInvoice.dueAt ? ` · due ${formatDate(data.openInvoice.dueAt)}` : ""}</Typography.Paragraph>
          {data.openInvoice.meta.instructions && <Alert type="info" title={data.openInvoice.meta.instructions} />}
          {data.openInvoice.checkoutUrl && <Button type="primary" style={{ marginTop: 12 }} href={data.openInvoice.checkoutUrl}>Pay now</Button>}
        </Card>
      )}

      <Card title="Plans" extra={<Segmented value={cycle} onChange={(v) => setCycle(v as "monthly" | "yearly")} options={[{ label: "Monthly", value: "monthly" }, { label: `Yearly (${12 - data.pricing.yearlyMonths} months free)`, value: "yearly" }]} />}>
        <Row gutter={[16, 16]}>
          {Object.entries(data.plans).map(([key, p]) => {
            const current = key === ent.subscribedPlan && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(ent.status);
            return (
              <Col xs={24} md={12} xl={6} key={key}>
                <Card title={p.name} extra={<Typography.Text strong>{p.priceMonthly === 0 ? "Free" : `${data.currency} ${price(p)}${cycle === "yearly" ? "/yr" : "/mo"}`}</Typography.Text>} style={{ height: "100%", borderColor: current ? "var(--brand-color)" : undefined }}>
                  <ul style={{ paddingLeft: 18, lineHeight: 1.9, marginTop: 0 }}>
                    <li>{lim(p.users)} users · {lim(p.templates)} workflows</li>
                    <li>{lim(p.requestsPerMonth)} requests / month</li>
                    <li>{p.storageMb >= 1024 ? `${p.storageMb / 1024} GB` : `${p.storageMb} MB`} storage</li>
                    <li>{p.whiteLabel ? "White-label" : "Basic branding"}{p.customDomain ? " + custom domain" : ""}</li>
                    <li>{p.apiAccess ? "API access" : "No API"}{p.webhooks ? " + webhooks" : ""}</li>
                    <li>{p.auditRetentionDays} days audit retention</li>
                  </ul>
                  {key === "FREE" ? (
                    <Button block disabled>{ent.plan === "FREE" ? "Current plan" : "Downgrade by cancelling"}</Button>
                  ) : (
                    <Button block type={current && ent.status === "ACTIVE" ? "default" : "primary"} disabled={!isOwner || (current && ent.status === "ACTIVE" && !sub.cancelAtPeriodEnd)} onClick={() => setChoosing(key)}>
                      {current && ent.status === "ACTIVE" ? "Current plan" : current && ent.status === "TRIALING" ? "Subscribe (end trial)" : ent.status === "PAST_DUE" && current ? "Pay now" : `Choose ${p.name}`}
                    </Button>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
        {!isOwner && <Typography.Text type="secondary">Only the workspace owner can change the plan.</Typography.Text>}
      </Card>

      <Card title="Invoices & payments">
        <Table<Invoice> rowKey="id" size="small" dataSource={invoices || []} pagination={false} locale={{ emptyText: "No invoices yet" }}
          columns={[
            { title: "Number", dataIndex: "number", render: (v) => <span className="mono">{v}</span> },
            { title: "Description", dataIndex: "description", ellipsis: true },
            { title: "Amount", render: (_, i) => `${i.currency} ${(i.amountCents / 100).toFixed(2)}` },
            { title: "Period", render: (_, i) => `${formatDate(i.periodStart)} → ${formatDate(i.periodEnd)}` },
            { title: "Status", dataIndex: "status", render: (s) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
            { title: "Paid", render: (_, i) => i.paidAt ? formatDate(i.paidAt) : i.status === "PENDING" && i.checkoutUrl ? <a href={i.checkoutUrl}>Pay</a> : "–" },
          ]} />
      </Card>

      <Modal open={!!choosing} title={choosing ? `Subscribe to ${data.plans[choosing]?.name}` : ""} onCancel={() => setChoosing(null)} onOk={checkout} confirmLoading={busy} okText={data.provider.provider === "manual" ? "Create invoice" : "Continue to payment"}>
        {choosing && (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Typography.Text>{data.plans[choosing].name} · {cycle} · <b>{data.currency} {price(data.plans[choosing])}</b></Typography.Text>
            <Typography.Text type="secondary">Payment method: {PROVIDER_LABEL[data.provider.provider]}</Typography.Text>
            {data.provider.provider === "paynow" && (
              <>
                <Radio.Group value={method} onChange={(e) => setMethod(e.target.value)} options={[{ value: "card", label: "Pay on Paynow (card / wallet)" }, { value: "mobile", label: "EcoCash / OneMoney prompt to my phone" }]} />
                {method === "mobile" && <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number, e.g. 0771234567" />}
              </>
            )}
            {data.provider.provider === "manual" && <Typography.Text type="secondary">An invoice with bank details will be created. Your plan activates as soon as the transfer is confirmed.</Typography.Text>}
          </Space>
        )}
      </Modal>

      <Modal open={!!result} title={result?.invoice ? `Invoice ${result.invoice.number} created` : "Payment"} onOk={() => setResult(null)} onCancel={() => setResult(null)} cancelButtonProps={{ style: { display: "none" } }}>
        {result?.instructions && <Alert type="info" title={result.instructions} />}
        {!result?.instructions && <Typography.Text>Follow the prompt on your phone to approve the payment. This page updates once it is confirmed.</Typography.Text>}
      </Modal>
    </Space>
  );
}

export default function BillingPage() {
  return <Suspense><Billing /></Suspense>;
}
