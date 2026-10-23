"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api } from "@/lib/client";
import { PASSWORD_POLICY } from "@/lib/security";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

export default function RegisterPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const onFinish = async (values: { orgName: string; slug: string; name: string; email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ verifyEmail: boolean }>("/api/auth/register", { method: "POST", json: values });
      if (res.verifyEmail) { setVerifyEmail(values.email); return; }
      router.replace("/app?welcome=1");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (verifyEmail) {
    return (
      <AuthShell title="Check your email" subtitle="One last step.">
        <Alert type="success" showIcon title={`We sent a confirmation link to ${verifyEmail}.`} description="Open it to activate your workspace. The link is valid for 24 hours." />
        <Typography.Paragraph style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}><Link href="/login">Back to sign in</Link></Typography.Paragraph>
      </AuthShell>
    );
  }

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
        <Form.Item name="password" label="Password" extra={PASSWORD_POLICY.description} rules={[{ required: true, min: PASSWORD_POLICY.minLength, message: `At least ${PASSWORD_POLICY.minLength} characters` }]}>
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
