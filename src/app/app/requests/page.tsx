"use client";

import { Button, Input, Select, Space, Table, Typography, Avatar, Tooltip } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { downloadUrl, formatDate, formatMoney, useApi, useMe } from "@/lib/client";
import { PriorityTag, StatusTag } from "@/components/StatusTag";
import { ROLE_RANK } from "@/lib/roles";

interface Row {
  id: string; referenceNo: string; title: string; status: string; priority: string; createdAt: string; submittedAt?: string | null;
  requester: { id: string; name: string; avatarUrl?: string | null }; template: { id: string; name: string; color?: string | null };
  project?: { id: string; code: string; name: string } | null; costAmount: number | null;
  pendingWith: { id: string; name: string }[];
}
interface Page { total: number; page: number; pageSize: number; items: Row[] }

export default function RequestsPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const [scopeChoice, setScope] = useState<string | null>(null);
  // Managers and above default to the whole organisation; members to requests involving them.
  const scope = scopeChoice ?? (me ? (isManager ? "all" : "involved") : "involved");
  const [status, setStatus] = useState<string | undefined>();
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [projectId, setProjectId] = useState<string | undefined>();
  const { data: projects } = useApi<{ id: string; code: string; name: string }[]>("/api/projects?all=1");
  const currency = me?.org.settings.currency || "USD";
  // Header search lands here with ?q=… (read after mount so server and client render the same markup)
  const [q, setQ] = useState("");
  useEffect(() => { const v = new URLSearchParams(window.location.search).get("q"); if (v) setQ(v); }, []);
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), pageSize: "20", scope, ...(status ? { status } : {}), ...(templateId ? { templateId } : {}), ...(projectId ? { projectId } : {}), ...(q ? { q } : {}) });
  const { data, isLoading } = useApi<Page>(`/api/requests?${qs}`);
  const { data: templates } = useApi<{ id: string; name: string }[]>("/api/templates");

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={3} className="page-title">Requests</Typography.Title>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={() => downloadUrl(`/api/requests/export?${templateId ? `templateId=${templateId}&` : ""}${status ? `status=${status}` : ""}`)}>Export CSV</Button>
          <Link href="/app/requests/new"><Button type="primary" icon={<PlusOutlined />}>New request</Button></Link>
        </Space>
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search key={q} placeholder="Search title or reference" allowClear defaultValue={q} onSearch={(v) => { setQ(v); setPage(1); }} style={{ width: 260 }} />
        <Select value={scope} onChange={(v) => { setScope(v); setPage(1); }} style={{ width: 170 }}
          options={[{ value: "mine", label: "My requests" }, { value: "involved", label: "Involving me" }, ...(isManager ? [{ value: "all", label: "All requests" }] : [])]} />
        <Select placeholder="Status" allowClear value={status} onChange={(v) => { setStatus(v); setPage(1); }} style={{ width: 150 }}
          options={["DRAFT", "PENDING", "APPROVED", "REJECTED", "RETURNED", "CANCELLED"].map((s) => ({ value: s, label: s }))} />
        <Select placeholder="Workflow" allowClear value={templateId} onChange={(v) => { setTemplateId(v); setPage(1); }} style={{ width: 220 }}
          options={(templates || []).map((t) => ({ value: t.id, label: t.name }))} />
        <Select placeholder="Project" allowClear showSearch optionFilterProp="label" value={projectId} onChange={(v) => { setProjectId(v); setPage(1); }} style={{ width: 220 }}
          options={(projects || []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
      </Space>
      <Table<Row>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items || []}
        pagination={{ current: page, pageSize: 20, total: data?.total || 0, onChange: setPage, showTotal: (t) => `${t} requests` }}
        onRow={(r) => ({ onClick: () => router.push(`/app/requests/${r.id}`), className: "clickable-row" })}
        columns={[
          { title: "Reference", dataIndex: "referenceNo", width: 150, render: (v) => <span className="mono">{v}</span> },
          { title: "Title", dataIndex: "title", ellipsis: true },
          { title: "Workflow", dataIndex: ["template", "name"], width: 170 },
          { title: "Project", width: 150, render: (_, r) => r.project ? <span title={r.project.name}><span className="mono">{r.project.code}</span></span> : <span className="muted">–</span> },
          { title: "Cost", width: 120, align: "right", render: (_, r) => r.costAmount == null ? <span className="muted">–</span> : <span className="mono">{formatMoney(r.costAmount, currency)}</span> },
          { title: "Requester", dataIndex: ["requester", "name"], width: 170, render: (_, r) => <Space><Avatar size="small" src={r.requester.avatarUrl || undefined}>{r.requester.name.slice(0, 1)}</Avatar>{r.requester.name}</Space> },
          { title: "Priority", dataIndex: "priority", width: 100, render: (p) => <PriorityTag priority={p} /> },
          { title: "Status", dataIndex: "status", width: 120, render: (s) => <StatusTag status={s} /> },
          { title: "Waiting on", width: 160, render: (_, r) => r.pendingWith.length ? <Tooltip title={r.pendingWith.map((p) => p.name).join(", ")}>{r.pendingWith[0].name}{r.pendingWith.length > 1 ? ` +${r.pendingWith.length - 1}` : ""}</Tooltip> : <span className="muted">–</span> },
          { title: "Created", dataIndex: "createdAt", width: 120, render: (d) => formatDate(d) },
        ]}
      />
    </div>
  );
}
