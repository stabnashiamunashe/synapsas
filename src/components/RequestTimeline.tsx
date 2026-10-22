"use client";

import { Avatar, Space, Steps, Tag, Tooltip, Typography } from "antd";
import { CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled, MinusCircleOutlined, RollbackOutlined, UserSwitchOutlined } from "@ant-design/icons";
import type { LevelDef } from "@/lib/types";
import { formatDate } from "@/lib/client";

export interface ApprovalRow {
  id: string; levelOrder: number; levelName: string; status: string; comment?: string | null; actedAt?: string | null; dueAt?: string | null; createdAt: string;
  approver: { id: string; name: string; avatarUrl?: string | null };
}

const APPROVER_TYPE_LABEL: Record<string, string> = {
  USER: "Named approver(s)", ROLE: "By role", DEPARTMENT_HEAD: "Department head", REQUESTER_MANAGER: "Line manager",
  FIELD_USER: "Chosen on the form", FIELD_DEPARTMENT_HEAD: "Head of chosen department",
};

function icon(status: string) {
  switch (status) {
    case "APPROVED": return <CheckCircleFilled style={{ color: "#52c41a" }} />;
    case "REJECTED": return <CloseCircleFilled style={{ color: "#ff4d4f" }} />;
    case "RETURNED": return <RollbackOutlined style={{ color: "#fa8c16" }} />;
    case "DELEGATED": return <UserSwitchOutlined style={{ color: "#722ed1" }} />;
    case "ESCALATED": return <ClockCircleOutlined style={{ color: "#fa541c" }} />;
    case "SKIPPED": return <MinusCircleOutlined style={{ color: "#bfbfbf" }} />;
    default: return <ClockCircleOutlined style={{ color: "#1677ff" }} />;
  }
}

/** Vertical steps view of all levels, with the approvals recorded at each. */
export function RequestTimeline({ levels, activeLevels, approvals, currentLevel, status }: {
  levels: LevelDef[]; activeLevels: number[]; approvals: ApprovalRow[]; currentLevel: number; status: string;
}) {
  const sorted = [...levels].sort((a, b) => a.order - b.order);
  const done = status === "APPROVED";
  const current = sorted.findIndex((l) => l.order === currentLevel);
  return (
    <Steps
      orientation="vertical"
      size="small"
      current={done ? sorted.length : Math.max(0, current)}
      status={status === "REJECTED" ? "error" : status === "RETURNED" ? "error" : undefined}
      items={sorted.map((l) => {
        const skipped = activeLevels.length > 0 && !activeLevels.includes(l.order);
        const rows = approvals.filter((a) => a.levelOrder === l.order);
        const levelState = skipped ? "skipped" : rows.some((r) => r.status === "APPROVED") && (l.mode === "ANY" || rows.every((r) => r.status !== "PENDING")) ? "finish"
          : rows.some((r) => r.status === "REJECTED" || r.status === "RETURNED") ? "error" : l.order === currentLevel && status === "PENDING" ? "process" : "wait";
        return {
          title: (
            <Space wrap>
              <span>{l.name}</span>
              <Tag style={{ marginInlineEnd: 0 }}>{l.mode === "ALL" ? "All must approve" : "Any one approves"}</Tag>
              {skipped && <Tag color="default">Skipped by condition</Tag>}
              {l.slaHours ? <Tag color="blue">SLA {l.slaHours}h</Tag> : null}
            </Space>
          ),
          status: levelState === "skipped" ? "wait" : (levelState as "finish" | "error" | "process" | "wait"),
          content: (
            <div style={{ marginTop: 4 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{APPROVER_TYPE_LABEL[l.approverType]}{l.condition ? ` · only when ${l.condition.field} ${l.condition.op} ${String(l.condition.value ?? "")}` : ""}</Typography.Text>
              {rows.map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 6 }}>
                  <Avatar size="small" src={r.approver.avatarUrl || undefined}>{r.approver.name.slice(0, 1)}</Avatar>
                  <div style={{ flex: 1 }}>
                    <Space size={6}>
                      {icon(r.status)}
                      <Typography.Text>{r.approver.name}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {r.status === "PENDING" ? (r.dueAt ? <Tooltip title={`Due ${formatDate(r.dueAt, true)}`}>{new Date(r.dueAt) < new Date() ? <span style={{ color: "#ff4d4f" }}>overdue</span> : "pending"}</Tooltip> : "pending") : `${r.status.toLowerCase()} ${r.actedAt ? formatDate(r.actedAt, true) : ""}`}
                      </Typography.Text>
                    </Space>
                    {r.comment && <div style={{ fontSize: 13, color: "rgba(0,0,0,.65)", marginTop: 2 }}>“{r.comment}”</div>}
                  </div>
                </div>
              ))}
            </div>
          ),
        };
      })}
    />
  );
}
