"use client";

import { Badge, Button, Calendar, Card, Col, Empty, Row, Select, Skeleton, Space, Table, Tabs, Tag, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { downloadUrl, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";

interface Entry { id: string; referenceNo: string; status: string; leaveType: string; days: number | null; from: string; to: string; user: { id: string; name: string }; department?: { id: string; name: string; code?: string | null } | null }
interface Cal { month: string; entries: Entry[]; holidays: { date: string; name: string }[]; canSeeAll: boolean; myDepartmentId: string | null }
interface Reg { year: number; entitlement: number; rows: { id: string; name: string; jobTitle?: string | null; department: string; entitlement: number; taken: number; pending: number; remaining: number; sick: number; other: number }[] }

const TYPE_COLOR: Record<string, string> = { Vacation: "#1414D2", Annual: "#1414D2", Sick: "#e5484d", Maternity: "#c026d3", Study: "#0e7490", Compassionate: "#7c3aed", Special: "#d97706" };
const colorFor = (t: string) => TYPE_COLOR[Object.keys(TYPE_COLOR).find((k) => t.toLowerCase().includes(k.toLowerCase())) || ""] || "#22a06b";

export default function LeavePage() {
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const [month, setMonth] = useState(dayjs());
  const [dept, setDept] = useState<string | undefined>();
  const { data: departments } = useApi<{ id: string; name: string }[]>(isManager ? "/api/departments" : null);
  const { data, isLoading } = useApi<Cal>(`/api/leave/calendar?month=${month.format("YYYY-MM")}${dept ? `&departmentId=${dept}` : ""}`);
  const year = month.year();
  const { data: reg } = useApi<Reg>(isManager ? `/api/leave/register?year=${year}${dept ? `&departmentId=${dept}` : ""}` : null);

  const onDay = (d: Dayjs) => {
    const key = d.format("YYYY-MM-DD");
    const items = (data?.entries || []).filter((e) => key >= e.from && key <= e.to);
    const hol = data?.holidays.find((h) => h.date === key);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {hol && <Tag color="volcano" style={{ fontSize: 10, lineHeight: "16px", margin: 0 }}>{hol.name}</Tag>}
        {items.slice(0, 3).map((e) => <Link key={e.id} href={`/app/requests/${e.id}`} style={{ fontSize: 11, lineHeight: "16px", color: "inherit", display: "flex", alignItems: "center", gap: 4, opacity: e.status === "PENDING" ? 0.65 : 1 }} title={`${e.user.name} · ${e.leaveType} (${e.status.toLowerCase()})`}><Badge color={colorFor(e.leaveType)} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.user.name.split(" ")[0]}{e.status === "PENDING" ? "?" : ""}</span></Link>)}
        {items.length > 3 && <span className="muted" style={{ fontSize: 10 }}>+{items.length - 3} more</span>}
      </div>
    );
  };

  const away = (data?.entries || []).filter((e) => e.status === "APPROVED");
  const todayKey = dayjs().format("YYYY-MM-DD");
  const outToday = away.filter((e) => todayKey >= e.from && todayKey <= e.to);

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Leave calendar & register</Typography.Title>
          <div className="muted">Who is away when, from approved and pending leave applications, with public holidays. Managers see balances for their section.</div>
        </div>
        <Space wrap>
          {isManager && <Select allowClear placeholder="All sections" value={dept} onChange={setDept} style={{ width: 220 }} showSearch optionFilterProp="label" options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} />}
          {isManager && <Button icon={<DownloadOutlined />} onClick={() => downloadUrl(`/api/leave/register?year=${year}&format=csv${dept ? `&departmentId=${dept}` : ""}`)}>Register CSV</Button>}
        </Space>
      </div>
      <Tabs items={[
        {
          key: "calendar", label: "Calendar", children: (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={17}>
                <Card styles={{ body: { padding: 8 } }}>
                  {isLoading && !data ? <Skeleton active /> : <Calendar value={month} onPanelChange={(d) => setMonth(d)} onSelect={(d, info) => { if (info.source === "month" || info.source === "year") setMonth(d); }} cellRender={(d, info) => (info.type === "date" ? onDay(d) : info.originNode)} />}
                </Card>
              </Col>
              <Col xs={24} lg={7}>
                <Space orientation="vertical" style={{ width: "100%" }} size={16}>
                  <Card title={`Out today (${outToday.length})`} size="small">
                    {outToday.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Everyone is in" /> : outToday.map((e) => <div key={e.id} style={{ marginBottom: 6 }}><Badge color={colorFor(e.leaveType)} text={<span><b>{e.user.name}</b> · {e.leaveType}</span>} /><div className="muted" style={{ fontSize: 12, marginLeft: 14 }}>until {dayjs(e.to).format("D MMM")} · {e.department?.name}</div></div>)}
                  </Card>
                  <Card title={`On leave in ${month.format("MMMM")} (${data?.entries.length || 0})`} size="small">
                    {!data?.entries.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leave this month" /> : data.entries.map((e) => <div key={e.id} style={{ marginBottom: 6, fontSize: 13 }}><Link href={`/app/requests/${e.id}`}><Badge color={colorFor(e.leaveType)} /> {e.user.name}</Link> <span className="muted">{dayjs(e.from).format("D MMM")} – {dayjs(e.to).format("D MMM")}{e.days ? ` · ${e.days}d` : ""}</span> {e.status === "PENDING" && <Tag style={{ marginLeft: 4 }}>pending</Tag>}</div>)}
                  </Card>
                  <Card title="Public holidays" size="small">
                    {!data?.holidays.length ? <span className="muted">None this month{isManager ? ". Add them under Settings → Organisation." : ""}</span> : data.holidays.map((h) => <div key={h.date}><b>{dayjs(h.date).format("ddd D MMM")}</b> · {h.name}</div>)}
                  </Card>
                </Space>
              </Col>
            </Row>
          ),
        },
        ...(isManager ? [{
          key: "register", label: `Leave register ${year}`, children: (
            <Card>
              <Typography.Paragraph type="secondary">Entitlement {reg?.entitlement ?? 12} days of annual leave per calendar year. Taken = approved annual/vacation leave; pending applications are shown separately and do not reduce the balance until approved.</Typography.Paragraph>
              <Table rowKey="id" dataSource={reg?.rows || []} size="small" pagination={{ pageSize: 50, hideOnSinglePage: true }} scroll={{ x: 800 }} columns={[
                { title: "Officer", render: (_, r: Reg["rows"][number]) => <span><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.jobTitle}</div></span> },
                { title: "Section", dataIndex: "department" },
                { title: "Entitlement", dataIndex: "entitlement", width: 100, align: "right" as const },
                { title: "Taken", dataIndex: "taken", width: 90, align: "right" as const },
                { title: "Pending", dataIndex: "pending", width: 90, align: "right" as const, render: (v: number) => (v ? <Tag>{v}</Tag> : "–") },
                { title: "Remaining", dataIndex: "remaining", width: 100, align: "right" as const, render: (v: number) => <b style={{ color: v <= 2 ? "#b45309" : undefined }}>{v}</b> },
                { title: "Sick", dataIndex: "sick", width: 80, align: "right" as const },
                { title: "Other", dataIndex: "other", width: 80, align: "right" as const },
              ]} />
            </Card>
          ),
        }] : []),
      ]} />
    </div>
  );
}
