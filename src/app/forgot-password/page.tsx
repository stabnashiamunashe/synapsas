"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api } from "@/lib/client";

function Forgot() {
  const params = useSearchParams();
  const slug = params.get("org");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onFinish = async (v: { email: string }) => {
    setLoading(true); setError(null);
    try { await api("/api/auth/password/forgot", { method: "POST", json: { email: v.email, slug: slug || undefined } }); setSent(true); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  return (
    <AuthShell slug={slug} title="Reset your password" subtitle="Enter your email and we will send a reset link if an account exists.">
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
      {sent ? (
        <Alert type="success" showIcon title="Check your email" description="If that address belongs to an account, a reset link valid for 1 hour has been sent." />
      ) : (
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input size="large" autoComplete="email" /></Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>Send reset link</Button>
        </Form>
      )}
      <Typography.Paragraph style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
        <Link href={`/login${slug ? `?org=${slug}` : ""}`}>Back to sign in</Link>
      </Typography.Paragraph>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return <Suspense><Forgot /></Suspense>;
}
