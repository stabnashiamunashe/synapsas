"use client";

import { App, Avatar, Badge, Button, Card, Col, Dropdown, Empty, Input, Modal, Row, Segmented, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography } from "antd";
import { AppstoreOutlined, DownloadOutlined, FilterOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, TableOutlined } from "@ant-design/icons";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { api, downloadUrl, formatDate, timeAgo, useApi, useMe } from "@/lib/client";
import { CASE_PRIORITIES, CASE_PRIORITY_LABELS, CASE_STATUSES, CASE_STATUS_COLORS, CASE_STATUS_LABELS, CASE_TRANSITIONS, type CasePriority, type CaseStatus } from "@/lib/caseTypes";
import { CaseDrawer } from "@/components/cases/CaseDrawer";
import { PriorityDot, SlaBadge, StatusPill, type CaseListItem } from "@/components/cases/CaseBits";

interface ListResponse { items: CaseListItem[]; total: number; page: number; pageSize: number; totalPages: number; countsByStatus: Record<string, number>; slaBreachedCount: number; settings: { defaultView: "board" | "table"; boardColumns: CaseStatus[]; requireTransitionReason: boolean } }
interface Stats { total: number; open: number; resolved: number; resolutionRatePct: number; slaBreached: number; avgResolutionHours: number | null; avgRating: number | null }
interface View { id: string; name: string; filters: Record<string, string>; isDefault: boolean }
type Filters = { q?: string; status?: string; priority?: string; departmentId?: string; categoryId?: string; assigneeId?: string; projectId?: string; slaBreached?: string; mine?: string };

function CasesBoard() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const [filters, setFilters] = useState<Filters>({});
  const [view, setView] = useState<"board" | "table" | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    p.set("page", String(view === "table" ? page : 1));
    p.set("pageSize", view === "table" ? "50" : "200");
    return p.toString();
  }, [filters, page, view]);
  const { data, mutate, isLoading } = useApi<ListResponse>(`/api/cases?${qs}`, { refreshInterval: 30000 });
  const { data: stats, mutate: mutateStats } = useApi<Stats>("/api/cases/stats");
  const { data: departments } = useApi<{ id: string; name: string }[]>("/api/departments");
  const { data: categories } = useApi<{ id: string; name: string; departmentId: string }[]>("/api/case-categories");
  const { data: users } = useApi<{ id: string; name: string }[]>("/api/users");
  const { data: views, mutate: mutateViews } = useApi<View[]>("/api/case-views");
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [local, setLocal] = useState<CaseListItem[] | null>(null);
  const [reasonFor, setReasonFor] = useState<{ item: CaseListItem; to: CaseStatus } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => { if (data && view === null) setView(data.settings.defaultView); }, [data, view]);
  useEffect(() => { setLocal(null); }, [data]);
  useEffect(() => {
    if (!views || view === null) return;
    const def = views.find((v) => v.isDefault);
    if (def && Object.keys(filters).length === 0 && !params.get("open")) setFilters(def.filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  const items = local || data?.items || [];
  const columns = data?.settings.boardColumns || [...CASE_STATUSES];
  const refresh = useCallback(() => { mutate(); mutateStats(); }, [mutate, mutateStats]);
  const openCase = (id: string) => { setOpen(id); router.replace(`/app/cases?open=${id}`); };
  const closeCase = () => { setOpen(null); router.replace("/app/cases"); };

  const doMove = async (item: CaseListItem, to: CaseStatus, why?: string) => {
    try {
      await api(`/api/cases/${item.id}/status`, { method: "POST", json: { version: item.version, status: to, reason: why || undefined } });
      setReasonFor(null); setReason("");
      refresh();
    } catch (e) {
      const err = e as { status?: number; message: string };
      message.error(err.status === 409 ? "Someone else changed this case. Reloaded." : err.message);
      setLocal(null); refresh();
    }
  };
  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    const item = items.find((c) => c.id === r.draggableId);
    const to = r.destination.droppableId as CaseStatus;
    if (!item) return;
    const admin = me?.user.role === "OWNER" || me?.user.role === "ADMIN";
    if (!admin && !CASE_TRANSITIONS[item.status]?.includes(to)) return message.warning(`${CASE_STATUS_LABELS[item.status]} cannot move straight to ${CASE_STATUS_LABELS[to]}`);
    setLocal(items.map((c) => (c.id === item.id ? { ...c, status: to } : c)));
    if (data?.settings.requireTransitionReason) setReasonFor({ item, to });
    else doMove(item, to);
  };

  const filterBar = (
    <Space wrap size={[8, 8]} style={{ width: "100%" }}>
      <Input.Search allowClear placeholder="Search reference, title, reporter, phone, location" style={{ width: 300 }} defaultValue={filters.q} onSearch={(v) => setFilters((f) => ({ ...f, q: v || undefined }))} />
      <Select allowClear placeholder="Section" style={{ width: 170 }} value={filters.departmentId} onChange={(v) => setFilters((f) => ({ ...f, departmentId: v, categoryId: undefined }))} options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} />
      <Select allowClear placeholder="Category" style={{ width: 170 }} value={filters.categoryId} onChange={(v) => setFilters((f) => ({ ...f, categoryId: v }))} options={(categories || []).filter((c) => !filters.departmentId || c.departmentId === filters.departmentId).map((c) => ({ value: c.id, label: c.name }))} />
      <Select allowClear placeholder="Assignee" style={{ width: 160 }} showSearch optionFilterProp="label" value={filters.assigneeId} onChange={(v) => setFilters((f) => ({ ...f, assigneeId: v }))} options={[{ value: "none", label: "Unassigned" }, ...(users || []).map((u) => ({ value: u.id, label: u.name }))]} />
      <Select allowClear mode="multiple" placeholder="Priority" style={{ minWidth: 150 }} value={filters.priority ? filters.priority.split(",") : []} onChange={(v) => setFilters((f) => ({ ...f, priority: v.length ? v.join(",") : undefined }))} options={CASE_PRIORITIES.map((p) => ({ value: p, label: CASE_PRIORITY_LABELS[p] }))} />
      {view === "table" && <Select allowClear mode="multiple" placeholder="Status" style={{ minWidth: 160 }} value={filters.status ? filters.status.split(",") : []} onChange={(v) => setFilters((f) => ({ ...f, status: v.length ? v.join(",") : undefined }))} options={CASE_STATUSES.map((s) => ({ value: s, label: CASE_STATUS_LABELS[s] }))} />}
      <span><Switch size="small" checked={filters.slaBreached === "1"} onChange={(v) => setFilters((f) => ({ ...f, slaBreached: v ? "1" : undefined }))} /> SLA breached</span>
      <span><Switch size="small" checked={filters.mine === "1"} onChange={(v) => setFilters((f) => ({ ...f, mine: v ? "1" : undefined }))} /> My cases</span>
      <Dropdown menu={{ items: [
        ...(views || []).map((v) => ({ key: v.id, label: <span onClick={() => setFilters(v.filters)}>{v.name}{v.isDefault ? " (default)" : ""}</span>, extra: <a onClick={async (e) => { e.stopPropagation(); await api(`/api/case-views/${v.id}`, { method: "DELETE" }); mutateViews(); }}>remove</a> })),
        { type: "divider" }, { key: "save", icon: <SaveOutlined />, label: "Save current filters as a view", onClick: () => setSaveOpen(true) },
        { key: "clear", label: "Clear filters", onClick: () => setFilters({}) },
      ] }}><Button icon={<FilterOutlined />}>Views</Button></Dropdown>
    </Space>
  );

  const card = (c: CaseListItem) => (
    <div onClick={() => openCase(c.id)} style={{ background: "#fff", border: "1px solid #e5e8ec", borderLeft: `3px solid ${CASE_STATUS_COLORS[c.status]}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, cursor: "pointer", boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 11 }}>
        <span className="mono muted">{c.referenceNo}</span>
        <Space size={4}><PriorityDot priority={c.priority} /><SlaBadge c={c} compact /></Space>
      </div>
      <div style={{ fontWeight: 600, margin: "4px 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 6 }}>
        <Space size={4} wrap>{c.category && <Tag style={{ marginInlineEnd: 0, fontSize: 11 }}>{c.category.name}</Tag>}{c.department && <Tag style={{ marginInlineEnd: 0, fontSize: 11 }} color="blue">{c.department.code || c.department.name}</Tag>}</Space>
        <Tooltip title={c.assignee ? c.assignee.name : "Unassigned"}><Avatar size={22} src={c.assignee?.avatarUrl || undefined} style={{ background: c.assignee ? "var(--brand-color)" : "#cbd2da", fontSize: 11 }}>{c.assignee ? c.assignee.name.slice(0, 1) : "?"}</Avatar></Tooltip>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-head-left">
          <div className="title-row"><Typography.Title level={3} className="page-title">Service desk</Typography.Title>{data && data.slaBreachedCount > 0 && <span className="pill pill-red">{data.slaBreachedCount} SLA breached</span>}</div>
          <div className="muted">Cases, tickets and public reports. Drag a card to change its status.</div>
        </div>
        <Space wrap>
          <Segmented value={view || "board"} onChange={(v) => setView(v as "board" | "table")} options={[{ value: "board", icon: <AppstoreOutlined />, label: "Board" }, { value: "table", icon: <TableOutlined />, label: "Table" }]} />
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={isLoading} />
          {(me?.user.role === "OWNER" || me?.user.role === "ADMIN" || me?.user.role === "MANAGER") && <Button icon={<DownloadOutlined />} onClick={() => downloadUrl("/api/cases/export")}>CSV</Button>}
          <Link href="/app/cases/new"><Button type="primary" icon={<PlusOutlined />}>Log a case</Button></Link>
        </Space>
      </div>
      {stats && (
        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={12} md={6}><Card size="small" className="stat-card"><Statistic title="Open cases" value={stats.open} /></Card></Col>
          <Col xs={12} md={6}><Card size="small" className="stat-card"><Statistic title="Resolution rate" value={stats.resolutionRatePct} suffix="%" /></Card></Col>
          <Col xs={12} md={6}><Card size="small" className="stat-card"><Statistic title="Avg. resolution" value={stats.avgResolutionHours ?? "–"} suffix={stats.avgResolutionHours !== null ? "h" : ""} /></Card></Col>
          <Col xs={12} md={6}><Card size="small" className="stat-card"><Statistic title="SLA breached" value={stats.slaBreached} styles={{ content: { color: stats.slaBreached ? "#c53030" : undefined } }} /></Card></Col>
        </Row>
      )}
      <Card size="small" style={{ marginBottom: 14 }}>{filterBar}</Card>

      {view === "table" ? (
        <Table<CaseListItem> rowKey="id" dataSource={items} loading={isLoading} size="small" scroll={{ x: 1100 }} onRow={(c) => ({ onClick: () => openCase(c.id), style: { cursor: "pointer" } })}
          pagination={{ current: data?.page || 1, pageSize: 50, total: data?.total || 0, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: "Ref", dataIndex: "referenceNo", width: 130, render: (v) => <span className="mono">{v}</span> },
            { title: "Title", dataIndex: "title", ellipsis: true },
            { title: "Status", dataIndex: "status", width: 120, render: (s) => <StatusPill status={s} />, sorter: (a, b) => a.status.localeCompare(b.status) },
            { title: "Priority", dataIndex: "priority", width: 100, render: (p: CasePriority) => <PriorityDot priority={p} withLabel />, sorter: (a, b) => CASE_PRIORITIES.indexOf(a.priority) - CASE_PRIORITIES.indexOf(b.priority) },
            { title: "Section", width: 150, render: (_, c) => c.department?.name || "–" },
            { title: "Category", width: 150, render: (_, c) => c.category?.name || "–" },
            { title: "Assignee", width: 150, render: (_, c) => c.assignee?.name || <span className="muted">Unassigned</span> },
            { title: "SLA", width: 130, render: (_, c) => <SlaBadge c={c} /> },
            { title: "Reporter", width: 150, render: (_, c) => <span>{c.reporterName}<div className="muted" style={{ fontSize: 11 }}>{c.source.toLowerCase().replace("_", " ")}</div></span> },
            { title: "Logged", dataIndex: "createdAt", width: 120, render: (d) => <Tooltip title={formatDate(d, true)}>{timeAgo(d)}</Tooltip>, sorter: (a, b) => a.createdAt.localeCompare(b.createdAt) },
          ]} />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}>
            {columns.map((status) => {
              const col = items.filter((c) => c.status === status);
              return (
                <Droppable droppableId={status} key={status}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ minWidth: 290, width: 290, flexShrink: 0, background: snapshot.isDraggingOver ? "#eef4ff" : "#f5f6f8", borderRadius: 10, padding: 10, minHeight: 200, border: "1px solid #eef0f3" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <Space size={6}><span style={{ width: 10, height: 10, borderRadius: 10, background: CASE_STATUS_COLORS[status], display: "inline-block" }} /><b>{CASE_STATUS_LABELS[status]}</b></Space>
                        <Badge count={data?.countsByStatus?.[status] ?? col.length} showZero color="#cbd2da" style={{ color: "#1f2933" }} />
                      </div>
                      {col.map((c, i) => (
                        <Draggable draggableId={c.id} index={i} key={c.id}>
                          {(p, s) => <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} style={{ ...p.draggableProps.style, transform: s.isDragging ? `${p.draggableProps.style?.transform || ""} rotate(1.5deg)` : p.draggableProps.style?.transform }}>{card(c)}</div>}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {col.length === 0 && !snapshot.isDraggingOver && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} style={{ margin: "24px 0" }} />}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}

      <CaseDrawer id={open} onClose={closeCase} onChanged={refresh} requireReason={data?.settings.requireTransitionReason} />
      <Modal open={!!reasonFor} title={reasonFor ? `Move ${reasonFor.item.referenceNo} to ${CASE_STATUS_LABELS[reasonFor.to]}` : ""} onCancel={() => { setReasonFor(null); setLocal(null); }} onOk={() => reasonFor && doMove(reasonFor.item, reasonFor.to, reason)} okText="Move">
        <Input.TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required by your settings)" autoSize={{ minRows: 2 }} />
      </Modal>
      <Modal open={saveOpen} title="Save view" onCancel={() => setSaveOpen(false)} okText="Save" onOk={async () => { if (!viewName.trim()) return; await api("/api/case-views", { method: "POST", json: { name: viewName.trim(), filters, isDefault: false } }); setViewName(""); setSaveOpen(false); mutateViews(); message.success("View saved"); }}>
        <Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="e.g. ICT · breached" />
      </Modal>
    </div>
  );
}

export default function CasesPage() {
  return <Suspense><CasesBoard /></Suspense>;
}
