"use client";

import { Badge, Button, Card, Empty, Popover, Space, Tag, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, timeAgo, useMe } from "@/lib/client";

export const NOTIF_COLORS: Record<string, string> = { APPROVAL: "blue", SUCCESS: "green", ERROR: "red", WARNING: "orange", COMMENT: "purple", INFO: "default" };

interface N { id: string; title: string; body?: string | null; link?: string | null; type: string; readAt?: string | null; createdAt: string }

/** Header bell with the latest notifications, mark-all-read and a link to the full page. */
export function NotificationTray() {
  const { data: me, mutate } = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = (me?.recentNotifications || []) as N[];

  const openItem = async (n: N) => {
    setOpen(false);
    if (!n.readAt) { await api(`/api/notifications/${n.id}/read`, { method: "POST" }); mutate(); }
    if (n.link) router.push(n.link);
  };
  const markAll = async () => { await api("/api/notifications", { method: "POST" }); mutate(); };

  const content = (
    <div style={{ width: 360 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Typography.Text strong>Notifications</Typography.Text>
        <Button size="small" type="link" onClick={markAll} disabled={!me?.unread}>Mark all read</Button>
      </div>
      {items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing yet" /> : (
        <Space orientation="vertical" style={{ width: "100%" }} size={6}>
          {items.map((n) => (
            <Card key={n.id} size="small" hoverable onClick={() => openItem(n)} style={{ background: n.readAt ? "#fff" : "#f3f6fb", borderLeft: n.readAt ? undefined : "3px solid var(--brand-color)" }} styles={{ body: { padding: "8px 10px" } }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <Typography.Text strong style={{ fontSize: 13 }} ellipsis>{n.title}</Typography.Text>
                <Tag color={NOTIF_COLORS[n.type] || "default"} style={{ marginInlineEnd: 0 }}>{n.type.toLowerCase()}</Tag>
              </div>
              {n.body && <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: "2px 0 0", fontSize: 12 }}>{n.body}</Typography.Paragraph>}
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
            </Card>
          ))}
        </Space>
      )}
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <Link href="/app/notifications" onClick={() => setOpen(false)}>View all notifications</Link>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight" arrow={false}>
      <Badge count={me?.unread || 0} size="small" offset={[-2, 2]}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} aria-label="Notifications" />
      </Badge>
    </Popover>
  );
}
