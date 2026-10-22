"use client";

import { Alert, Button, Form, Input, Spin, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api } from "@/lib/client";
import type { BrandingSettings } from "@/lib/types";

interface InviteInfo { email: string; role: string; org: { name: string; slug: string; branding: BrandingSettings } }

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<InviteInfo>(`/api/auth/invitations/${token}`).then(setInfo).catch((e) => setError((e as Error).message));
  }, [token]);

  const onFinish = async (values: { name: string; password: string }) => {
    setLoading(true);
    try {
      await api(`/api/auth/invitations/${token}`, { method: "POST", json: values });
      router.replace("/app");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell slug={info?.org.slug} title={info ? `Join ${info.org.name}` : "Invitation"} subtitle={info ? `You were invited as ${info.role.toLowerCase()} (${info.email}).` : undefined}>
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
      {!info && !error && <Spin />}
      {info && (
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Your name" rules={[{ required: true, min: 2 }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Choose a password" rules={[{ required: true, min: 8 }]}>
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>Accept invitation</Button>
        </Form>
      )}
      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, textAlign: "center" }}>
        Invitations expire after 7 days.
      </Typography.Paragraph>
    </AuthShell>
  );
}
