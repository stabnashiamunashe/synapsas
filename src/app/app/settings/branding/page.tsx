"use client";

import { Alert, App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Skeleton, Switch, Typography } from "antd";
import { useRouter } from "next/navigation";
import { api, useMe } from "@/lib/client";

export default function BrandingPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const { data: me, mutate } = useMe();
  const [form] = Form.useForm();
  if (!me) return <Skeleton active />;
  const canWhiteLabel = me.org.limits.whiteLabel;
  const canDomain = me.org.limits.customDomain;
  const loginUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/login?org=${me.org.slug}`;

  const save = async (values: Record<string, unknown>) => {
    const { customDomain, ...branding } = values;
    try {
      await api("/api/org", { method: "PATCH", json: { branding, customDomain: canDomain ? customDomain || null : undefined } });
      message.success("Branding saved");
      mutate();
      router.refresh();
    } catch (e) { message.error((e as Error).message); }
  };

  return (
    <div>
      {!canWhiteLabel && <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Full white-labelling (logo, login page, hide vendor branding, custom domain) is available on Starter and above. Free plans can set the product name and colour." />}
      <Card title="White-label branding" extra={<Typography.Text type="secondary">Tenant login: <span className="mono">{loginUrl}</span></Typography.Text>}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ ...me.org.branding, customDomain: me.org.customDomain || "" }}>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="productName" label="Product name" extra="Shown in the sidebar, browser tab and login page."><Input placeholder="ZimStat Approvals" /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="primaryColor" label="Primary colour" rules={[{ pattern: /^#[0-9a-fA-F]{6}$/, message: "Hex colour like #1677ff" }]}><Input type="color" /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="borderRadius" label="Corner radius"><InputNumber min={0} max={24} style={{ width: "100%" }} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="logoUrl" label="Logo URL" extra="PNG/SVG with transparent background works best."><Input disabled={!canWhiteLabel} placeholder="https://…/logo.png" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="faviconUrl" label="Favicon URL"><Input disabled={!canWhiteLabel} placeholder="https://…/favicon.png" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="sidebarTheme" label="Sidebar theme"><Select disabled={!canWhiteLabel} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="supportEmail" label="Support email"><Input disabled={!canWhiteLabel} type="email" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="loginTagline" label="Login page tagline"><Input disabled={!canWhiteLabel} placeholder="Approvals, simplified." /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="loginBackgroundUrl" label="Login background image URL"><Input disabled={!canWhiteLabel} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="footerText" label="Footer text"><Input disabled={!canWhiteLabel} placeholder="© ZimStat" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="customDomain" label="Custom domain" extra={canDomain ? "Point a CNAME at this app; the login page will pick up your branding automatically." : "Business plan or higher."}><Input disabled={!canDomain} placeholder="approvals.zimstat.co.zw" /></Form.Item></Col>
            <Col span={24}><Form.Item name="hideVendorBranding" label="Hide “Powered by” vendor branding" valuePropName="checked"><Switch disabled={!canWhiteLabel} /></Form.Item></Col>
          </Row>
          <Button type="primary" htmlType="submit">Save branding</Button>
        </Form>
      </Card>
    </div>
  );
}
