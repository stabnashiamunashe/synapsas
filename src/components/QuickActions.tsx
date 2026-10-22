"use client";

import { Button, Tooltip } from "antd";
import { BarChartOutlined, InboxOutlined, PlusOutlined, SendOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";
import { tint } from "./Providers";

interface Tpl { id: string; name: string; icon?: string | null; color?: string | null; levels: unknown[] }

/**
 * Colour-coded action row (reference: "Send · Request · Transfer · Deposit · Pay Bill · Create Invoice").
 * Primary action is solid; each workflow shortcut is an outlined button tinted with that workflow's colour;
 * Inbox is blue and Reports purple so the row reads at a glance.
 */
export function QuickActions() {
  const { data: templates } = useApi<Tpl[]>("/api/templates?active=1");
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  return (
    <div className="quick-actions">
      <Link href="/app/requests/new"><Button type="primary" icon={<SendOutlined />}>New request</Button></Link>
      {(templates || []).slice(0, 4).map((t) => {
        const c = t.color || "#003B32";
        return (
          <Tooltip key={t.id} title={`${t.levels.length} approval level${t.levels.length === 1 ? "" : "s"}`}>
            <Link href={`/app/requests/new?template=${t.id}`}>
              <Button className="btn-icon-color" icon={<PlusOutlined />} style={{ ["--btn-icon" as string]: c, background: tint(c, 0.93), borderColor: tint(c, 0.7), color: "#111827" }}>
                {t.icon ? `${t.icon} ` : ""}{t.name}
              </Button>
            </Link>
          </Tooltip>
        );
      })}
      <Link href="/app/inbox"><Button className="btn-tint btn-blue" icon={<InboxOutlined />}>Inbox{me?.pendingApprovals ? ` · ${me.pendingApprovals}` : ""}</Button></Link>
      {isManager && <Link href="/app/reports"><Button className="btn-tint btn-purple" icon={<BarChartOutlined />}>Reports</Button></Link>}
    </div>
  );
}
