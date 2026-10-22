"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api } from "@/lib/client";
import { PASSWORD_POLICY } from "@/lib/security";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onFinish = async (v: { password: string }) => {
    setLoading(true); setError(null);
    try { await api("/api/auth/password/reset", { method: "POST", json: { token, password: v.password } }); router.replace("/login?reset=1"); }
    catch (e) {
      const err = e as { message: string; details?: { message: string }[] };
      setError(err.details?.length ? err.details.map((d) => d.message).join(". ") : err.message);
    } finally { setLoading(false); }
  };
  return (
    <AuthShell title="Choose a new password" subtitle={PASSWORD_POLICY.description}>
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="password" label="New password" rules={[{ required: true, min: PASSWORD_POLICY.minLength }]}><Input.Password size="large" autoComplete="new-password" /></Form.Item>
        <Form.Item name="confirm" label="Confirm password" dependencies={["password"]} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, v) => (v === getFieldValue("password") ? Promise.resolve() : Promise.reject(new Error("Passwords do not match"))) })]}><Input.Password size="large" autoComplete="new-password" /></Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>Update password</Button>
      </Form>
      <Typography.Paragraph type="secondary" style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
        All other sessions will be signed out. <Link href="/login">Back to sign in</Link>
      </Typography.Paragraph>
    </AuthShell>
  );
}
