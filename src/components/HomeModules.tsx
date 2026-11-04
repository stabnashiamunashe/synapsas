"use client";

import { Alert, Space, Tag } from "antd";
import Link from "next/link";
import { formatMoney, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";

interface Notice { id: string; title: string; requiresAck: boolean; acknowledged: boolean }
interface Bal { outstanding: number; count: number; overdue: number }
interface LicSummary { items: { id: string; status: string }[]; counts: Record<string, number>; expiringSoon: number }

/** Dashboard strips from the modules: unacknowledged notices, my advance account, licensing work. */
export function HomeModules() {
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const { data: notices } = useApi<Notice[]>("/api/notices");
  const { data: bal } = useApi<Bal>("/api/advances/balance");
  const { data: lic } = useApi<LicSummary>(me ? "/api/licences?mine=1" : null);
  const unacked = (notices || []).filter((n) => n.requiresAck && !n.acknowledged);
  const c = lic?.counts || {};
  const licOpen = (c.SUBMITTED || 0) + (c.UNDER_REVIEW || 0) + (c.INSPECTION || 0) + (c.APPROVED || 0);
  const mineOpen = (lic?.items || []).filter((l) => ["SUBMITTED", "UNDER_REVIEW", "INSPECTION", "APPROVED"].includes(l.status)).length;
  const showLic = !!lic && (mineOpen > 0 || (isManager && (licOpen > 0 || lic.expiringSoon > 0)));
  if (!unacked.length && !(bal && bal.count) && !showLic) return null;
  return (
    <Space orientation="vertical" style={{ width: "100%", marginBottom: 16 }} size={8}>
      {unacked.length > 0 && (
        <Alert type="info" showIcon title={<span>{unacked.length} notice{unacked.length === 1 ? "" : "s"} to acknowledge</span>}
          description={<span>{unacked.slice(0, 3).map((n) => <Link key={n.id} href={`/app/notices?open=${n.id}`} style={{ marginRight: 12 }}>{n.title}</Link>)}{unacked.length > 3 && <Link href="/app/notices">and {unacked.length - 3} more</Link>}</span>} />
      )}
      {showLic && (
        <Alert type={lic!.expiringSoon ? "warning" : "info"} showIcon
          title={<span>Licensing: <b>{licOpen}</b> application{licOpen === 1 ? "" : "s"} awaiting action{mineOpen ? <Tag color="blue" style={{ marginLeft: 8 }}>{mineOpen} assigned to you</Tag> : null}{lic!.expiringSoon ? <Tag color="gold" style={{ marginLeft: 8 }}>{lic!.expiringSoon} expiring within 30 days</Tag> : null}</span>}
          description={<span><Link href="/app/licences?scope=open">Open the register</Link>{lic!.expiringSoon ? <> · <Link href="/app/licences?scope=expiring">Expiring licences</Link></> : null}</span>} />
      )}
      {bal && bal.count > 0 && (
        <Alert type={bal.overdue ? "error" : "warning"} showIcon title={<span>Your advance account: <b>{formatMoney(bal.outstanding)}</b> outstanding on {bal.count} advance{bal.count === 1 ? "" : "s"}{bal.overdue ? <Tag color="red" style={{ marginLeft: 8 }}>{bal.overdue} overdue</Tag> : null}</span>}
          description={<span>Submit a T&S Expense Claim with receipts to clear it. <Link href="/app/advances">View ledger</Link></span>} />
      )}
    </Space>
  );
}
