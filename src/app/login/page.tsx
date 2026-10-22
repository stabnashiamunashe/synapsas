"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api } from "@/lib/client";

interface LoginResult { twoFactorRequired?: boolean; challenge?: string; forcePasswordChange?: boolean }

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get("org");
  const next = params.get("next") || "/app";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [useBackup, setUseBackup] = useState(false);

  const finish = () => {
    router.replace(next.startsWith("/") ? next : "/app");
    router.refresh();
  };

  const onPassword = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<LoginResult>("/api/auth/login", { method: "POST", json: { ...values, slug: slug || undefined } });
      if (res.twoFactorRequired && res.challenge) setChallenge(res.challenge);
      else finish();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onCode = async (values: { code: string }) => {
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/2fa/verify", { method: "POST", json: { challenge, code: values.code } });
      finish();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (challenge) {
    return (
      <AuthShell slug={slug} title="Two-factor verification" subtitle={useBackup ? "Enter one of your backup codes." : "Enter the 6-digit code from your authenticator app."}>
        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onCode}>
          <Form.Item name="code" label={useBackup ? "Backup code" : "Authentication code"} rules={[{ required: true }]}>
            <Input size="large" autoFocus autoComplete="one-time-code" inputMode={useBackup ? "text" : "numeric"} placeholder={useBackup ? "XXXX-XXXX" : "123 456"} className="mono" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>Verify</Button>
        </Form>
        <Typography.Paragraph style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
          <a onClick={() => setUseBackup(!useBackup)}>{useBackup ? "Use authenticator app" : "Use a backup code"}</a> · <a onClick={() => { setChallenge(null); setError(null); }}>Start over</a>
        </Typography.Paragraph>
      </AuthShell>
    );
  }

  return (
    <AuthShell slug={slug} title="Sign in" subtitle="Welcome back. Enter your details to continue.">
      {params.get("reset") && <Alert type="success" showIcon title="Password updated. Sign in with your new password." style={{ marginBottom: 16 }} />}
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={onPassword} initialValues={{ email: "", password: "" }}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
          <Input size="large" placeholder="you@company.com" autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true }]}>
          <Input.Password size="large" autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>Sign in</Button>
      </Form>
      <Typography.Paragraph style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
        <Link href={`/forgot-password${slug ? `?org=${slug}` : ""}`}>Forgot password?</Link> · New here? <Link href="/register">Create a workspace</Link>
      </Typography.Paragraph>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
