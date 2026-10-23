"use client";

import { Alert, Button, Spin, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { api } from "@/lib/client";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ verified: boolean; orgSlug: string }>("/api/auth/verify-email", { method: "POST", json: { token } })
      .then(() => {
        if (cancelled) return;
        setState("done");
        setTimeout(() => { router.replace("/app?welcome=1"); router.refresh(); }, 1200);
      })
      .catch((e) => { if (!cancelled) { setState("error"); setError((e as Error).message); } });
    return () => { cancelled = true; };
  }, [token, router]);

  return (
    <AuthShell title="Confirming your email" subtitle="One moment.">
      {state === "working" && <div style={{ textAlign: "center", padding: 24 }}><Spin size="large" /></div>}
      {state === "done" && <Alert type="success" showIcon title="Email confirmed. Taking you to your workspace…" />}
      {state === "error" && (
        <>
          <Alert type="error" showIcon title={error || "This link is not valid"} style={{ marginBottom: 16 }} />
          <Typography.Paragraph>Request a new confirmation link from the sign-in page.</Typography.Paragraph>
          <Link href="/login"><Button type="primary" block size="large">Go to sign in</Button></Link>
        </>
      )}
    </AuthShell>
  );
}
