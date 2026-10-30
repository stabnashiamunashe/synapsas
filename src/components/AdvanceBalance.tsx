"use client";

import { Alert, Tag } from "antd";
import Link from "next/link";
import { formatDate, formatMoney, useApi } from "@/lib/client";

interface Bal { outstanding: number; count: number; overdue: number; items: { id: string; referenceNo: string; outstanding: number; dueAt: string; overdue: boolean }[] }

/** "Advance account balance" strip for T&S forms: what the Finance Section certifies before a new advance is approved. */
export function AdvanceBalance({ userId, compact }: { userId?: string | null; compact?: boolean }) {
  const { data } = useApi<Bal>(userId ? `/api/advances/balance?userId=${userId}` : "/api/advances/balance");
  if (!data) return null;
  if (data.count === 0) return <Alert type="success" showIcon title="Advance account balance: USD 0.00" description={compact ? undefined : "No outstanding advances. A new advance can be certified."} style={{ marginBottom: 12 }} />;
  return (
    <Alert type={data.overdue ? "error" : "warning"} showIcon style={{ marginBottom: 12 }}
      title={<span>Advance account balance: <b>{formatMoney(data.outstanding)}</b> outstanding on {data.count} advance{data.count === 1 ? "" : "s"}{data.overdue ? ` (${data.overdue} overdue)` : ""}</span>}
      description={<span>{data.items.map((a) => <Tag key={a.id} color={a.overdue ? "red" : "gold"}>{a.referenceNo} · {formatMoney(a.outstanding)} · clear by {formatDate(a.dueAt)}</Tag>)}<div style={{ marginTop: 6 }}>Advances must be cleared within 10 days of return before a new one is approved. <Link href="/app/advances">Open the ledger</Link>.</div></span>} />
  );
}
