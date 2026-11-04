"use client";

import { Button, Card, Descriptions, Form, Input, Result, Typography } from "antd";
import { SafetyCertificateOutlined, SearchOutlined } from "@ant-design/icons";
import { useState } from "react";
import { PublicShell } from "@/components/PublicShell";
import { api, formatDate } from "@/lib/client";
import { StatusTag } from "@/components/StatusTag";

interface Verified { licenceNo: string; type: string; category: string; holder: string; premises: string | null; status: string; issuedAt: string | null; expiresAt: string | null }

/** Public licence verification: enter a licence number printed on a certificate and see whether it is current. */
export default function VerifyPage() {
  const [data, setData] = useState<Verified | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const lookup = async (v: { no: string }) => {
    setLoading(true);
    try { setData(await api<Verified | null>(`/api/public/licence-verify?no=${encodeURIComponent(v.no.trim())}`)); } catch { setData(null); } finally { setLoading(false); }
  };
  return (
    <PublicShell active="verify">
      {() => (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Typography.Title level={3} className="page-title" style={{ marginBottom: 4 }}>Verify a licence</Typography.Title>
          <Typography.Paragraph type="secondary">Enter the licence number shown on the certificate (for example RLB/SHP/{new Date().getFullYear()}/0001) to confirm it was issued by the council and is still valid.</Typography.Paragraph>
          <Card>
            <Form layout="inline" onFinish={lookup} style={{ gap: 8 }}>
              <Form.Item name="no" rules={[{ required: true, message: "Enter the licence number" }]} style={{ flex: 1, minWidth: 240 }}><Input size="large" placeholder="RLB/SHP/2026/0001" prefix={<SafetyCertificateOutlined />} /></Form.Item>
              <Button size="large" type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>Check</Button>
            </Form>
          </Card>
          {data === null && <Result status="warning" title="No licence with that number" subTitle="Check the number and try again. If the certificate shows this number, report it to the council's licensing office." style={{ marginTop: 16 }} />}
          {data && (
            <Card style={{ marginTop: 16 }} title={<span>Licence <span className="mono">{data.licenceNo}</span></span>} extra={<StatusTag status={data.status} />}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Licence">{data.type} · {data.category}</Descriptions.Item>
                <Descriptions.Item label="Holder">{data.holder}</Descriptions.Item>
                {data.premises && <Descriptions.Item label="Premises">{data.premises}</Descriptions.Item>}
                <Descriptions.Item label="Valid from">{formatDate(data.issuedAt)}</Descriptions.Item>
                <Descriptions.Item label="Valid until">{formatDate(data.expiresAt)}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </div>
      )}
    </PublicShell>
  );
}
