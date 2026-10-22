"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api } from "@/lib/client";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

export default function RegisterPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { orgName: string; slug: string; name: string; email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/register", { method: "POST", json: values });
      router.replace("/app?welcome=1");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your workspace" subtitle="Free to start. No card required.">
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="orgName" label="Organisation name" rules={[{ required: true, min: 2 }]}>
          <Input size="large" placeholder="Acme Ltd" onChange={(e) => form.setFieldValue("slug", slugify(e.target.value))} />
        </Form.Item>
        <Form.Item name="slug" label="Workspace URL" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: "Lowercase letters, numbers, dashes" }]}>
          <Input size="large" addonBefore="/login?org=" placeholder="acme" />
        </Form.Item>
        <Form.Item name="name" label="Your name" rules={[{ required: true, min: 2 }]}>
          <Input size="large" />
        </Form.Item>
        <Form.Item name="email" label="Work email" rules={[{ required: true, type: "email" }]}>
          <Input size="large" autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, min: 8, message: "At least 8 characters" }]}>
          <Input.Password size="large" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>Create workspace</Button>
      </Form>
      <Typography.Paragraph style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </Typography.Paragraph>
    </AuthShell>
  );
}
