"use client";

import { Alert, App, Button, Card, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { BrandProvider } from "@/components/Providers";
import { BrandLogo } from "@/components/BrandMark";

/**
 * Platform operator console (the SaaS vendor). Not a tenant screen.
 * Authenticates with PLATFORM_ADMIN_KEY; lists every workspace, confirms bank-transfer invoices, overrides plans, runs the billing sweep.
 */
interface Org {
  id: string; name: string; slug: string; plan: string; planStatus: string; cycle: string; renewsAt?: string | null; trialEndsAt?: string | null; graceEndsAt?: string | null;
  provider?: string | null; billingEmail?: string | null; createdAt: string; users: number; requests: number;
  entitlements: { plan: string; status: string; locked: boolean };
  openInvoices: { id: string; number: string; amountCents: number; currency: string; status: string; provider: string; description?: string | null; dueAt?: string | null }[];
}
const COLOR: Record<string, string> = { TRIALING: "blue", ACTIVE: "green", PAST_DUE: "red", CANCELLED: "default", EXPIRED: "orange", FREE: "default" };

export default function PlatformPage() {
  const { message } = App.useApp();
  const [key, setKey] = useState("");
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [override, setOverride] = useState<Org | null>(null);
  const [plan, setPlan] = useState("BUSINESS");
  const [status, setStatus] = useState("ACTIVE");
  const [months, setMonths] = useState(1);

  const headers = { "content-type": "application/json", "x-platform-key": key };
  const load = async () => {
    const r = await fetch("/api/admin/billing", { headers });
    const j = await r.json();
    if (!r.ok) return message.error(j.error || "Unauthorised");
    setOrgs(j.data);
  };
  const post = async (body: unknown) => {
    const r = await fetch("/api/admin/billing", { method: "POST", headers, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Failed");
    return j.data;
  };
  const markPaid = async (invoiceId: string) => { try { await post({ action: "markPaid", invoiceId }); message.success("Invoice marked paid; plan activated"); load(); } catch (e) { message.error((e as Error).message); } };
  const sweep = async () => { try { const r = await post({ action: "sweep" }); message.success(`Sweep: ${JSON.stringify(r)}`); load(); } catch (e) { message.error((e as Error).message); } };
  const applyOverride = async () => { if (!override) return; try { await post({ action: "setPlan", orgId: override.id, plan, status, months }); message.success("Updated"); setOverride(null); load(); } catch (e) { message.error((e as Error).message); } };

  return (
    <BrandProvider>
      <div style={{ minHeight: "100vh", background: "#eef0f3", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <Space><BrandLogo height={28} /><Typography.Title level={4} style={{ margin: 0 }}>Platform console</Typography.Title></Space>
          <Space.Compact>
            <Input.Password placeholder="Platform admin key" value={key} onChange={(e) => setKey(e.target.value)} style={{ width: 280 }} onPressEnter={load} />
            <Button type="primary" onClick={load}>Load workspaces</Button>
          </Space.Compact>
        </div>
        {!orgs ? <Alert type="info" showIcon title="Enter PLATFORM_ADMIN_KEY (from the server environment) to manage tenant billing." /> : (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Card size="small" extra={<Button onClick={sweep}>Run billing sweep now</Button>} title={`${orgs.length} workspaces`}>
              <Table<Org> rowKey="id" size="small" dataSource={orgs} pagination={false} scroll={{ x: true }}
                columns={[
                  { title: "Workspace", render: (_, o) => <span><b>{o.name}</b><div className="muted mono" style={{ fontSize: 11 }}>{o.slug} · {o.billingEmail || "no billing email"}</div></span> },
                  { title: "Plan", render: (_, o) => <span>{o.plan}<div className="muted" style={{ fontSize: 11 }}>in effect: {o.entitlements.plan}</div></span> },
                  { title: "Status", render: (_, o) => <Space><Tag color={COLOR[o.planStatus]}>{o.planStatus}</Tag>{o.entitlements.locked && <Tag color="red">LOCKED</Tag>}</Space> },
                  { title: "Dates", render: (_, o) => <span style={{ fontSize: 12 }}>{o.trialEndsAt ? `trial → ${new Date(o.trialEndsAt).toLocaleDateString()}` : ""}{o.renewsAt ? ` renews ${new Date(o.renewsAt).toLocaleDateString()}` : ""}{o.graceEndsAt ? ` grace → ${new Date(o.graceEndsAt).toLocaleDateString()}` : ""}</span> },
                  { title: "Usage", render: (_, o) => `${o.users} users · ${o.requests} requests` },
                  { title: "Open invoices", render: (_, o) => o.openInvoices.length ? o.openInvoices.map((i) => (
                    <div key={i.id} style={{ marginBottom: 4 }}>
                      <span className="mono">{i.number}</span> {i.currency} {(i.amountCents / 100).toFixed(2)} <Tag>{i.status}</Tag>
                      <Popconfirm title={`Confirm payment received for ${i.number}?`} onConfirm={() => markPaid(i.id)}><a>Mark paid</a></Popconfirm>
                    </div>
                  )) : <span className="muted">–</span> },
                  { title: "", render: (_, o) => <a onClick={() => { setOverride(o); setPlan(o.plan); setStatus(o.planStatus); }}>Override</a> },
                ]} />
            </Card>
          </Space>
        )}
        <Modal open={!!override} title={override ? `Override ${override.name}` : ""} onCancel={() => setOverride(null)} onOk={applyOverride} okText="Apply">
          <Space orientation="vertical" style={{ width: "100%" }}>
            <div><label className="muted">Plan</label><Select style={{ width: "100%" }} value={plan} onChange={setPlan} options={["FREE", "STARTER", "BUSINESS", "ENTERPRISE"].map((p) => ({ value: p, label: p }))} /></div>
            <div><label className="muted">Status</label><Select style={{ width: "100%" }} value={status} onChange={setStatus} options={["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED", "FREE"].map((s) => ({ value: s, label: s }))} /></div>
            <div><label className="muted">Extend period by (months)</label><Select style={{ width: "100%" }} value={months} onChange={setMonths} options={[0, 1, 3, 6, 12].map((m) => ({ value: m, label: m === 0 ? "Do not change" : `${m} month${m > 1 ? "s" : ""}` }))} /></div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Use for comped accounts, offline contracts or support fixes. Every override is written to the workspace audit log.</Typography.Text>
          </Space>
        </Modal>
      </div>
    </BrandProvider>
  );
}
