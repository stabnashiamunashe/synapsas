"use client";

import { Alert, Space, Tag } from "antd";
import Link from "next/link";
import { formatMoney, useApi } from "@/lib/client";

interface Notice { id: string; title: string; requiresAck: boolean; acknowledged: boolean }
interface Bal { outstanding: number; count: number; overdue: number }
interface Trip { id: string; destination: string; startsAt: string; status: string }

/** Dashboard strips from the modules: unacknowledged notices, my advance account, trips needing a vehicle. */
export function HomeModules() {
  const { data: notices } = useApi<Notice[]>("/api/notices");
  const { data: bal } = useApi<Bal>("/api/advances/balance");
  const unacked = (notices || []).filter((n) => n.requiresAck && !n.acknowledged);
  if (!unacked.length && !(bal && bal.count)) return null;
  return (
    <Space orientation="vertical" style={{ width: "100%", marginBottom: 16 }} size={8}>
      {unacked.length > 0 && (
        <Alert type="info" showIcon title={<span>{unacked.length} notice{unacked.length === 1 ? "" : "s"} to acknowledge</span>}
          description={<span>{unacked.slice(0, 3).map((n) => <Link key={n.id} href={`/app/notices?open=${n.id}`} style={{ marginRight: 12 }}>{n.title}</Link>)}{unacked.length > 3 && <Link href="/app/notices">and {unacked.length - 3} more</Link>}</span>} />
      )}
      {bal && bal.count > 0 && (
        <Alert type={bal.overdue ? "error" : "warning"} showIcon title={<span>Your advance account: <b>{formatMoney(bal.outstanding)}</b> outstanding on {bal.count} advance{bal.count === 1 ? "" : "s"}{bal.overdue ? <Tag color="red" style={{ marginLeft: 8 }}>{bal.overdue} overdue</Tag> : null}</span>}
          description={<span>Submit a T&S Expense Claim with receipts to clear it. <Link href="/app/advances">View ledger</Link></span>} />
      )}
    </Space>
  );
}
