"use client";

import { Alert, Avatar, Button, Card, Col, Empty, Progress, Row, Skeleton, Space, Statistic, Tag, Typography } from "antd";
import { StatCard } from "@/components/StatCard";
import { QuickActions } from "@/components/QuickActions";

const STATUS_TONE: Record<string, string> = { DRAFT: "#cbd2da", PENDING: "#f59e0b", APPROVED: "#22a06b", REJECTED: "#e5484d", RETURNED: "#d97706", CANCELLED: "#9aa3b2" };
import { ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, InboxOutlined, WarningOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useApi, useMe, timeAgo } from "@/lib/client";
import { PriorityTag, StatusTag } from "@/components/StatusTag";
import { CATEGORY_LABELS, type TemplateCategory } from "@/lib/types";

interface Dash {
  cards: { pendingMine: number; myRequests: number; pendingAll: number; approvedMonth: number; rejectedMonth: number; overdue: number; avgHours: number | null };
  byStatus: { status: string; count: number }[];
  byTemplate: { templateId: string; name: string; color?: string | null; count: number }[];
  recent: { id: string; referenceNo: string; title: string; status: string; priority: string; updatedAt: string; requester: { name: string; avatarUrl?: string | null }; template: { name: string; color?: string | null } }[];
}
interface InboxItem {
  approvalId: string; levelName: string; dueAt: string | null; overdue: boolean; waitingSince: string;
  request: { id: string; referenceNo: string; title: string; priority: string; requester: { name: string }; template: { name: string; color?: string | null } };
}
interface Tpl { id: string; name: string; icon?: string | null; color?: string | null; category: TemplateCategory; levels: unknown[] }

function Dashboard() {
  const router = useRouter();
  const { data, isLoading } = useApi<Dash>("/api/dashboard");
  const { data: inbox } = useApi<InboxItem[]>("/api/inbox");
  const { data: templates } = useApi<Tpl[]>("/api/templates?active=1");
  const { data: me } = useMe();
  const params = useSearchParams();
  const total = data?.byStatus.reduce((a, s) => a + s.count, 0) || 0;
  const tplMax = Math.max(1, ...(data?.byTemplate.map((t) => t.count) || [1]));

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Good day, {me?.user.name?.split(" ")[0] || ""}</Typography.Title>
          <Typography.Text type="secondary">Here is what needs your attention.</Typography.Text>
        </div>
        <QuickActions />
      </div>
      {params.get("welcome") && (
        <Alert type="success" showIcon style={{ marginBottom: 16 }} title="Workspace created"
          description={<span>Next steps: <Link href="/app/templates">design a workflow</Link>, <Link href="/app/users">invite your team</Link>, and <Link href="/app/settings/branding">brand your workspace</Link>.</span>} />
      )}
      {isLoading || !data ? <Skeleton active /> : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}><StatCard tone="blue" icon={<InboxOutlined />} value={data.cards.pendingMine} label="Waiting for me" onClick={() => router.push("/app/inbox")} hint={data.cards.pendingMine ? <span style={{ color: "#1d4ed8" }}>Review now →</span> : <span className="muted">All caught up</span>} /></Col>
            <Col xs={12} md={6}><StatCard tone="purple" icon={<ClockCircleOutlined />} value={data.cards.pendingAll} label="In progress" hint={data.cards.overdue ? <span style={{ color: "#b45309" }}>{data.cards.overdue} overdue</span> : <span className="muted">No overdue steps</span>} /></Col>
            <Col xs={12} md={6}><StatCard tone="green" icon={<CheckCircleOutlined />} value={data.cards.approvedMonth} label="Approved this month" hint={<span className="muted">{data.cards.avgHours != null ? `${data.cards.avgHours}h avg. turnaround` : "No completed requests yet"}</span>} /></Col>
            <Col xs={12} md={6}><StatCard tone="orange" icon={<CloseCircleOutlined />} value={data.cards.rejectedMonth} label="Rejected this month" hint={<span className="muted">{data.cards.myRequests} requests raised by you</span>} /></Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Space orientation="vertical" style={{ width: "100%" }} size={16}>
                <Card title={`Awaiting my approval (${inbox?.length || 0})`} extra={<Link href="/app/inbox">Open inbox <ArrowRightOutlined /></Link>}>
                  {!inbox?.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing waiting on you" /> : (
                    <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                      {inbox.slice(0, 5).map((it) => (
                        <Card key={it.approvalId} size="small" hoverable onClick={() => router.push(`/app/requests/${it.request.id}`)} style={{ borderLeft: `3px solid ${it.request.template.color || "var(--brand-color)"}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 0 }}>
                              <Space size={6} wrap>
                                <span className="mono muted">{it.request.referenceNo}</span>
                                <Typography.Text strong>{it.request.title}</Typography.Text>
                                <PriorityTag priority={it.request.priority} />
                                {it.overdue && <Tag color="red">Overdue</Tag>}
                              </Space>
                              <div className="muted" style={{ fontSize: 12 }}>{it.request.template.name} · {it.request.requester.name} · {it.levelName} · waiting {timeAgo(it.waitingSince)}</div>
                            </div>
                            <Button size="small" type="primary">Review</Button>
                          </div>
                        </Card>
                      ))}
                    </Space>
                  )}
                </Card>

                <Card title="Recent activity" extra={<Link href="/app/requests">All requests <ArrowRightOutlined /></Link>}>
                  {data.recent.length === 0 ? <Empty description="No requests yet" /> : (
                    <Space orientation="vertical" style={{ width: "100%" }} size={8}>
                      {data.recent.map((r) => (
                        <Card key={r.id} size="small" hoverable onClick={() => router.push(`/app/requests/${r.id}`)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Avatar size="small" src={r.requester.avatarUrl || undefined}>{r.requester.name.slice(0, 1)}</Avatar>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div><span className="mono muted" style={{ marginRight: 8 }}>{r.referenceNo}</span><Typography.Text strong>{r.title}</Typography.Text></div>
                              <div className="muted" style={{ fontSize: 12 }}>{r.template.name} · {r.requester.name} · {timeAgo(r.updatedAt)}</div>
                            </div>
                            <StatusTag status={r.status} />
                          </div>
                        </Card>
                      ))}
                    </Space>
                  )}
                </Card>
              </Space>
            </Col>

            <Col xs={24} lg={10}>
              <Space orientation="vertical" style={{ width: "100%" }} size={16}>
                <Card title="Start a request">
                  {!templates?.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No workflows yet" /> : (
                    <Row gutter={[8, 8]}>
                      {templates.slice(0, 6).map((t) => (
                        <Col span={12} key={t.id}>
                          <Card size="small" hoverable onClick={() => router.push(`/app/requests/new?template=${t.id}`)} style={{ borderTop: `3px solid ${t.color || "var(--brand-color)"}`, height: "100%" }}>
                            <Typography.Text strong>{t.icon ? `${t.icon} ` : ""}{t.name}</Typography.Text>
                            <div className="muted" style={{ fontSize: 12 }}>{CATEGORY_LABELS[t.category] || t.category} · {t.levels.length} level{t.levels.length === 1 ? "" : "s"}</div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </Card>
                <Card title="Health">
                  <Row gutter={16}>
                    <Col span={12}><Statistic title="Overdue approvals" value={data.cards.overdue} prefix={<WarningOutlined />} styles={{ content: { color: data.cards.overdue ? "#c05621" : undefined } }} /></Col>
                    <Col span={12}><Statistic title="Avg. turnaround (7d)" value={data.cards.avgHours ?? "–"} suffix={data.cards.avgHours != null ? "h" : ""} /></Col>
                  </Row>
                </Card>
                <Card title="Request mix" extra={<span className="muted">{total} total</span>}>
                  <div className="stack-bar">
                    {data.byStatus.filter((s) => s.count > 0).map((s) => (
                      <span key={s.status} title={`${s.status}: ${s.count}`} style={{ width: `${total ? (s.count / total) * 100 : 0}%`, background: STATUS_TONE[s.status] || "#cbd2da" }} />
                    ))}
                  </div>
                  <div className="legend">
                    {data.byStatus.map((s) => (
                      <span key={s.status}><i style={{ background: STATUS_TONE[s.status] || "#cbd2da" }} />{s.status.charAt(0) + s.status.slice(1).toLowerCase()} <b style={{ color: "var(--text)" }}>{s.count}</b></span>
                    ))}
                  </div>
                </Card>
                <Card title="This month by workflow">
                  {data.byTemplate.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing yet" /> : data.byTemplate.map((t) => (
                    <div key={t.templateId} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{t.name}</span><span className="muted">{t.count}</span></div>
                      <Progress percent={Math.round((t.count / tplMax) * 100)} showInfo={false} size="small" strokeColor={t.color || undefined} />
                    </div>
                  ))}
                </Card>
              </Space>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense><Dashboard /></Suspense>;
}
