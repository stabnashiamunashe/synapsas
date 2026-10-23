"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api, ClientError } from "@/lib/client";
import { safeRedirectPath } from "@/lib/security";

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
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const finish = () => {
    router.replace(safeRedirectPath(next));
    router.refresh();
  };

  const resend = async () => {
    if (!unverified) return;
    await api("/api/auth/verify-email", { method: "PUT", json: { email: unverified, slug: slug || undefined } }).catch(() => undefined);
    setResent(true);
  };

  const onPassword = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<LoginResult>("/api/auth/login", { method: "POST", json: { ...values, slug: slug || undefined } });
      if (res.twoFactorRequired && res.challenge) setChallenge(res.challenge);
      else finish();
    } catch (e) {
      const err = e as ClientError;
      const code = (err.details as unknown as { code?: string } | undefined)?.code;
      if (err.status === 403 && code === "EMAIL_UNVERIFIED") { setUnverified(values.email); setResent(false); }
      else setError(err.message);
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
      {unverified && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Confirm your email address first"
          description={resent ? "A new confirmation link has been sent if the address is registered." : <span>We sent a confirmation link to <b>{unverified}</b>. Check your inbox, then sign in. <a onClick={resend}>Send it again</a></span>} />
      )}
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
