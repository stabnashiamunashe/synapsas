"use client";

import { Alert, App, Button, Card, Checkbox, Col, Input, Row, Select, Space, Steps, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, useApi, useMe } from "@/lib/client";
import { CATEGORY_LABELS, type TemplateCategory } from "@/lib/types";
import { PLANS, TRIAL_DAYS, TRIAL_PLAN } from "@/lib/plans";

const PRESET_OPTIONS: { key: TemplateCategory; text: string }[] = [
  { key: "REQUISITION", text: "Purchase requisitions with line items and a threshold-based executive level." },
  { key: "MEMO", text: "Internal memos reviewed by the line manager and department head." },
  { key: "DOCUMENT", text: "Policies, contracts and reports with a named reviewer." },
  { key: "LEAVE", text: "Leave requests approved by the line manager." },
  { key: "EXPENSE", text: "Expense claims with itemised costs and receipts." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { data: me, mutate } = useMe();
  const { data: status } = useApi<{ completed: boolean; org: { name: string; settings: { currency?: string; timezone?: string }; billingEmail?: string | null } }>("/api/onboarding");
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("Africa/Harare");
  const [billingEmail, setBillingEmail] = useState("");
  const [invites, setInvites] = useState<{ email: string; role: "ADMIN" | "MANAGER" | "MEMBER" }[]>([{ email: "", role: "MANAGER" }, { email: "", role: "MEMBER" }]);
  const [presets, setPresets] = useState<TemplateCategory[]>(["REQUISITION", "MEMO"]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ invites: { email: string; link: string }[]; created: string[] } | null>(null);

  useEffect(() => {
    if (status?.org) {
      setOrgName(status.org.name || "");
      setCurrency(status.org.settings.currency || "USD");
      setTimezone(status.org.settings.timezone || "Africa/Harare");
      setBillingEmail(status.org.billingEmail || me?.user.email || "");
    }
  }, [status, me]);

  if (me && me.user.role !== "OWNER") { router.replace("/app"); return null; }

  const finish = async () => {
    setBusy(true);
    try {
      const r = await api<{ invites: { email: string; link: string }[]; created: string[] }>("/api/onboarding", {
        method: "POST",
        json: { orgName, currency, timezone, billingEmail: billingEmail || undefined, invites: invites.filter((i) => i.email.trim()), presets },
      });
      setDone(r);
      mutate();
      router.refresh();
    } catch (e) {
      const err = e as { message: string; details?: { message: string }[] };
      message.error(err.details?.length ? err.details.map((d) => d.message).join(". ") : err.message);
    } finally { setBusy(false); }
  };

  const trial = PLANS[TRIAL_PLAN];

  if (done) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Card title="You're set up">
          <Alert type="success" showIcon title={`${orgName} is ready. Your ${trial.name} trial runs for ${TRIAL_DAYS} days.`} style={{ marginBottom: 16 }} />
          {done.created.length > 0 && <Typography.Paragraph>Workflows created: <b>{done.created.join(", ")}</b>.</Typography.Paragraph>}
          {done.invites.length > 0 && (
            <>
              <Typography.Paragraph>Invitation links (email delivery activates once a provider is configured; copy these for now):</Typography.Paragraph>
              {done.invites.map((i) => <div key={i.email} style={{ marginBottom: 6 }}><b>{i.email}</b>: <Typography.Text code copyable>{i.link}</Typography.Text></div>)}
            </>
          )}
          <Space style={{ marginTop: 12 }}>
            <Button type="primary" onClick={() => router.push("/app")}>Go to dashboard</Button>
            <Button onClick={() => router.push("/app/templates")}>Open workflows</Button>
            <Button onClick={() => router.push("/app/settings/billing")}>See plans</Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <Typography.Title level={3} className="page-title" style={{ marginBottom: 4 }}>Welcome to {me?.org.branding.productName || "your workspace"}</Typography.Title>
      <Typography.Paragraph type="secondary">Three quick steps. You can change all of this later in Settings.</Typography.Paragraph>
      <Steps current={step} items={[{ title: "Organisation" }, { title: "Team" }, { title: "Workflows" }, { title: "Plan" }]} style={{ marginBottom: 20 }} />
      <Card>
        {step === 0 && (
          <Row gutter={16}>
            <Col xs={24} md={12}><label className="muted">Organisation name</label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></Col>
            <Col xs={12} md={6}><label className="muted">Currency</label><Select style={{ width: "100%" }} value={currency} onChange={setCurrency} showSearch options={["USD", "ZWG", "ZAR", "EUR", "GBP", "KES", "NGN", "BWP", "ZMW", "MZN"].map((c) => ({ value: c, label: c }))} /></Col>
            <Col xs={12} md={6}><label className="muted">Timezone</label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Col>
            <Col xs={24} md={12} style={{ marginTop: 12 }}><label className="muted">Billing email (invoices and receipts)</label><Input value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} type="email" /></Col>
          </Row>
        )}
        {step === 1 && (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Typography.Text type="secondary">Invite the people who will approve requests. Managers and department heads drive routing; you can set who reports to whom under People afterwards.</Typography.Text>
            {invites.map((inv, i) => (
              <Space.Compact key={i} style={{ width: "100%" }}>
                <Input value={inv.email} type="email" placeholder="colleague@company.com" onChange={(e) => setInvites((s) => s.map((x, idx) => (idx === i ? { ...x, email: e.target.value } : x)))} />
                <Select value={inv.role} style={{ width: 140 }} onChange={(role) => setInvites((s) => s.map((x, idx) => (idx === i ? { ...x, role } : x)))} options={[{ value: "ADMIN", label: "Admin" }, { value: "MANAGER", label: "Manager" }, { value: "MEMBER", label: "Member" }]} />
              </Space.Compact>
            ))}
            <Button onClick={() => setInvites((s) => [...s, { email: "", role: "MEMBER" }])} disabled={invites.length >= 20}>Add another</Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Your trial includes up to {trial.users} users.</Typography.Text>
          </Space>
        )}
        {step === 2 && (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Typography.Text type="secondary">Start from ready-made workflows. Each becomes fully editable: fields, approval levels, SLAs, conditions and loop-backs.</Typography.Text>
            {PRESET_OPTIONS.map((p) => (
              <Card key={p.key} size="small" hoverable onClick={() => setPresets((s) => (s.includes(p.key) ? s.filter((x) => x !== p.key) : [...s, p.key]))} style={{ borderColor: presets.includes(p.key) ? "var(--brand-color)" : undefined }}>
                <Checkbox checked={presets.includes(p.key)}><b>{CATEGORY_LABELS[p.key]}</b> — <span className="muted">{p.text}</span></Checkbox>
              </Card>
            ))}
          </Space>
        )}
        {step === 3 && (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Alert type="info" showIcon title={`You are on a free ${TRIAL_DAYS}-day ${trial.name} trial with ${trial.users} users, ${trial.templates} workflows, white-label branding, API and webhooks.`} description="No payment is needed now. When the trial ends you drop to the Free plan; subscribe any time from Settings → Plan & billing to keep everything." />
            <Row gutter={12}>
              {Object.entries(PLANS).map(([k, p]) => (
                <Col xs={12} md={6} key={k}><Card size="small" title={p.name} extra={<b>{p.priceMonthly === 0 ? "Free" : `$${p.priceMonthly}/mo`}</b>}><div className="muted" style={{ fontSize: 12 }}>{p.users === -1 ? "Unlimited" : p.users} users · {p.templates === -1 ? "Unlimited" : p.templates} workflows</div></Card></Col>
              ))}
            </Row>
          </Space>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
          {step < 3 ? <Button type="primary" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && orgName.trim().length < 2}>Next</Button> : <Button type="primary" loading={busy} onClick={finish}>Finish setup</Button>}
        </div>
      </Card>
    </div>
  );
}
