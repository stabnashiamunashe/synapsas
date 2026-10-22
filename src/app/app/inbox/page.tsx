"use client";

import { Avatar, Button, Card, Empty, Segmented, Skeleton, Space, Tag, Typography } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApi, timeAgo } from "@/lib/client";
import { PriorityTag } from "@/components/StatusTag";

interface InboxItem {
  approvalId: string; levelOrder: number; levelName: string; dueAt: string | null; overdue: boolean; waitingSince: string;
  request: { id: string; referenceNo: string; title: string; priority: string; requester: { name: string; avatarUrl?: string | null }; template: { name: string; color?: string | null } };
}

export default function InboxPage() {
  const router = useRouter();
  const { data, isLoading } = useApi<InboxItem[]>("/api/inbox", { refreshInterval: 30000 });
  const [filter, setFilter] = useState<"all" | "overdue" | "urgent">("all");
  const items = (data || []).filter((i) => (filter === "overdue" ? i.overdue : filter === "urgent" ? ["HIGH", "URGENT"].includes(i.request.priority) : true));

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Inbox</Typography.Title>
          <Typography.Text type="secondary">Requests waiting for your decision.</Typography.Text>
        </div>
        <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[
          { label: `All (${data?.length || 0})`, value: "all" },
          { label: `Overdue (${data?.filter((i) => i.overdue).length || 0})`, value: "overdue" },
          { label: "High priority", value: "urgent" },
        ]} />
      </div>
      {isLoading ? <Skeleton active /> : !items.length ? <Card><Empty description={filter === "all" ? "You are all caught up" : "Nothing matches this filter"} /></Card> : (
        <Space orientation="vertical" style={{ width: "100%" }} size={8}>
          {items.map((item) => (
            <Card key={item.approvalId} size="small" hoverable onClick={() => router.push(`/app/requests/${item.request.id}`)} style={{ borderLeft: `3px solid ${item.overdue ? "#c53030" : item.request.template.color || "var(--brand-color)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <Avatar src={item.request.requester.avatarUrl || undefined}>{item.request.requester.name.slice(0, 1)}</Avatar>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <Space wrap size={6}>
                    <span className="mono muted">{item.request.referenceNo}</span>
                    <Typography.Text strong>{item.request.title}</Typography.Text>
                    <PriorityTag priority={item.request.priority} />
                    {item.overdue && <Tag color="red" icon={<ClockCircleOutlined />}>Overdue</Tag>}
                  </Space>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {item.request.template.name} · from {item.request.requester.name} · level {item.levelOrder}: <b>{item.levelName}</b> · waiting {timeAgo(item.waitingSince)}
                    {item.dueAt && !item.overdue ? ` · due ${new Date(item.dueAt).toLocaleString()}` : ""}
                  </div>
                </div>
                <Link href={`/app/requests/${item.request.id}`} onClick={(e) => e.stopPropagation()}><Button type="primary">Review</Button></Link>
              </div>
            </Card>
          ))}
        </Space>
      )}
    </div>
  );
}
