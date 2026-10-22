"use client";

import { App, Button, Card, Col, Dropdown, Empty, Row, Skeleton, Space, Switch, Tag, Typography } from "antd";
import { CopyOutlined, DeleteOutlined, MoreOutlined, PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApi } from "@/lib/client";
import { QuickWorkflowModal } from "@/components/QuickWorkflowModal";
import { CATEGORY_LABELS, type LevelDef, type TemplateCategory } from "@/lib/types";

interface T { id: string; name: string; description?: string | null; category: TemplateCategory; icon?: string | null; color?: string | null; prefix: string; isActive: boolean; version: number; fields: unknown[]; levels: LevelDef[]; _count: { requests: number } }

export default function TemplatesPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { data, isLoading, mutate } = useApi<T[]>("/api/templates");
  const [quickOpen, setQuickOpen] = useState(false);

  const toggle = async (t: T, isActive: boolean) => {
    try { await api(`/api/templates/${t.id}`, { method: "PATCH", json: { isActive } }); mutate(); } catch (e) { message.error((e as Error).message); }
  };
  const duplicate = async (t: T) => {
    try { const c = await api<T>(`/api/templates/${t.id}/duplicate`, { method: "POST" }); message.success("Duplicated"); router.push(`/app/templates/${c.id}`); } catch (e) { message.error((e as Error).message); }
  };
  const remove = async (t: T) => {
    try { await api(`/api/templates/${t.id}`, { method: "DELETE" }); message.success("Deleted"); mutate(); } catch (e) { message.error((e as Error).message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Workflows</Typography.Title>
          <Typography.Text type="secondary">Each workflow defines a form and the approval levels a request travels through.</Typography.Text>
        </div>
        <Space>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setQuickOpen(true)}>Quick create from stages</Button>
          <Link href="/app/templates/new"><Button icon={<PlusOutlined />}>Full builder</Button></Link>
        </Space>
      </div>
      <QuickWorkflowModal open={quickOpen} onClose={() => { setQuickOpen(false); mutate(); }} />
      {isLoading ? <Skeleton active /> : !data?.length ? <Empty description="No workflows yet"><Link href="/app/templates/new"><Button type="primary">Create the first one</Button></Link></Empty> : (
        <Row gutter={[16, 16]}>
          {data.map((t) => (
            <Col xs={24} md={12} xl={8} key={t.id}>
              <Card
                style={{ height: "100%", borderTop: `3px solid ${t.color || "#1677ff"}`, opacity: t.isActive ? 1 : 0.7 }}
                actions={[
                  <Link key="e" href={`/app/templates/${t.id}`}>Edit</Link>,
                  <Link key="n" href={`/app/requests/new?template=${t.id}`}>New request</Link>,
                  <Dropdown key="m" menu={{ items: [
                    { key: "dup", icon: <CopyOutlined />, label: "Duplicate", onClick: () => duplicate(t) },
                    { key: "del", icon: <DeleteOutlined />, label: "Delete", danger: true, disabled: t._count.requests > 0, onClick: () => remove(t) },
                  ] }}><MoreOutlined /></Dropdown>,
                ]}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <Typography.Text strong style={{ fontSize: 16 }}>{t.icon ? `${t.icon} ` : ""}{t.name}</Typography.Text>
                    <div><Tag>{CATEGORY_LABELS[t.category] || t.category}</Tag><Tag className="mono">{t.prefix}-YYYY-0001</Tag><Tag>v{t.version}</Tag></div>
                  </div>
                  <Switch checked={t.isActive} onChange={(v) => toggle(t, v)} checkedChildren="Active" unCheckedChildren="Off" />
                </div>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: "8px 0" }}>{t.description || "No description"}</Typography.Paragraph>
                <Space wrap size={[4, 4]}>
                  {t.levels.map((l) => <Tag key={l.id} color="blue" style={{ marginInlineEnd: 0 }}>{l.order}. {l.name}</Tag>)}
                  {t.levels.length === 0 && <Tag>Auto-approve</Tag>}
                </Space>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.fields.length} fields · {t._count.requests} requests</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
