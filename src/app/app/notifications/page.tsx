"use client";

import { Button, Card, Empty, Segmented, Space, Tag, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, timeAgo, useApi, useMe } from "@/lib/client";
import { NOTIF_COLORS } from "@/components/NotificationTray";

interface N { id: string; title: string; body?: string | null; link?: string | null; type: string; readAt?: string | null; createdAt: string }

export default function NotificationsPage() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, mutate } = useApi<{ items: N[]; unread: number }>(`/api/notifications${unreadOnly ? "?unread=1" : ""}`);
  const { mutate: mutateMe } = useMe();
  const markAll = async () => { await api("/api/notifications", { method: "POST" }); mutate(); mutateMe(); };
  const open = async (n: N) => {
    if (!n.readAt) { await api(`/api/notifications/${n.id}/read`, { method: "POST" }); mutate(); mutateMe(); }
    if (n.link) router.push(n.link);
  };
  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Notifications</Typography.Title>
          <Typography.Text type="secondary">Approvals, decisions and comments that involve you. Manage what you receive in <Link href="/app/profile?tab=notifications">your profile</Link>.</Typography.Text>
        </div>
        <Space>
          <Segmented value={unreadOnly ? "unread" : "all"} onChange={(v) => setUnreadOnly(v === "unread")} options={[{ label: "All", value: "all" }, { label: `Unread (${data?.unread || 0})`, value: "unread" }]} />
          <Button onClick={markAll} disabled={!data?.unread}>Mark all as read</Button>
        </Space>
      </div>
      {!data?.items.length ? <Card><Empty description="Nothing here yet" /></Card> : (
        <Space orientation="vertical" style={{ width: "100%" }} size={8}>
          {data.items.map((n) => (
            <Card key={n.id} size="small" hoverable={!!n.link} onClick={() => open(n)} style={{ background: n.readAt ? "#fff" : "#f3f6fb", borderLeft: n.readAt ? undefined : "3px solid var(--brand-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <Space size={8} wrap>
                    <Tag color={NOTIF_COLORS[n.type] || "default"} style={{ marginInlineEnd: 0 }}>{n.type.toLowerCase()}</Tag>
                    <Typography.Text strong>{n.title}</Typography.Text>
                  </Space>
                  {n.body && <div style={{ color: "rgba(0,0,0,.7)", marginTop: 4 }}>{n.body}</div>}
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{timeAgo(n.createdAt)}{n.link ? " · click to open" : ""}</div>
                </div>
                {!n.readAt && <Tag color="blue">new</Tag>}
              </div>
            </Card>
          ))}
        </Space>
      )}
    </div>
  );
}
