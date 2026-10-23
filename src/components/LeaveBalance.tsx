"use client";

import { Alert, Progress, Space, Typography } from "antd";
import { useApi } from "@/lib/client";

export interface LeaveBalanceData {
  userId: string; name: string; year: number; entitlement: number; taken: number; pending: number; remaining: number; availableAfterPending: number;
  requests: { id: string; referenceNo: string; title: string; status: string; days: number }[];
}

/**
 * The note printed at the foot of ZimStat's annual leave form: "out of 12 days annual leave you were allocated
 * this year, you have taken N days to date and you are left with a balance of M days."
 */
export function LeaveBalance({ userId, requestedDays, compact }: { userId?: string; requestedDays?: number; compact?: boolean }) {
  const { data } = useApi<LeaveBalanceData>(`/api/leave/balance${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`);
  if (!data) return null;
  const over = requestedDays !== undefined && requestedDays > data.availableAfterPending;
  const pct = data.entitlement ? Math.min(100, Math.round((data.taken / data.entitlement) * 100)) : 0;
  const text = `Out of ${data.entitlement} days annual leave allocated for ${data.year}, ${data.name} has taken ${data.taken} day${data.taken === 1 ? "" : "s"} to date and has a balance of ${data.remaining} day${data.remaining === 1 ? "" : "s"}${data.pending ? ` (${data.pending} more awaiting approval)` : ""}.`;
  return (
    <Alert
      type={over ? "error" : data.remaining <= 2 ? "warning" : "info"}
      showIcon
      style={{ marginBottom: compact ? 12 : 16 }}
      title={over ? `This request (${requestedDays} days) exceeds the available balance of ${data.availableAfterPending} days.` : "Annual leave balance"}
      description={
        <Space orientation="vertical" size={4} style={{ width: "100%" }}>
          <Typography.Text>{text}</Typography.Text>
          <Progress percent={pct} size="small" showInfo={false} strokeColor={over ? "#c53030" : undefined} />
        </Space>
      }
    />
  );
}
