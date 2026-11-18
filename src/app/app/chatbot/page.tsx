"use client";

import { Badge, Tabs, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useApi, useMe } from "@/lib/client";
import { Overview, type OverviewData } from "@/components/chatbot/Overview";
import { LiveChats } from "@/components/chatbot/LiveChats";
import { DataRequests } from "@/components/chatbot/DataRequests";
import { Conversations } from "@/components/chatbot/Conversations";
import { DataLog } from "@/components/chatbot/DataLog";

/**
 * The WhatsApp desk: what the chatbot is doing and everything staff act on from it. Live chats and data requests are
 * service-desk cases underneath (TK- and DR-), so they also appear on the cases board; this page is the place built for them.
 */
function Desk() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") || "overview";
  const { data: me } = useMe();
  const manager = ["OWNER", "ADMIN", "MANAGER"].includes(me?.user.role || "");
  const { data: ov, mutate } = useApi<OverviewData>("/api/chatbot/overview", { refreshInterval: 20000 });
  const go = (k: string) => router.replace(k === "overview" ? "/app/chatbot" : `/app/chatbot?tab=${k}`);
  const label = (text: string, n?: number) => <span>{text}{n ? <Badge count={n} size="small" offset={[8, -2]} /> : null}</span>;
  return (
    <div>
      <div className="page-header">
        <div className="page-head-left">
          <div className="title-row"><Typography.Title level={3} className="page-title">WhatsApp desk</Typography.Title>{ov && ov.chats.waiting > 0 && <span className="pill pill-red">{ov.chats.waiting} waiting for an officer</span>}</div>
          <div className="muted">Everything the chatbot handles: live chats with the public, data requests waiting for a decision, every conversation and the log of data handed out.</div>
        </div>
      </div>
      <Tabs activeKey={tab} onChange={go} destroyOnHidden items={[
        { key: "overview", label: "Overview", children: <Overview data={ov} onGo={go} /> },
        { key: "chats", label: label("Live chats", ov?.chats.waiting), children: <LiveChats onChanged={mutate} /> },
        { key: "requests", label: label("Data requests", ov?.dataRequests.pending), children: <DataRequests onChanged={mutate} /> },
        ...(manager ? [
          { key: "conversations", label: "Conversations", children: <Conversations /> },
          { key: "log", label: "Data log", children: <DataLog /> },
        ] : []),
      ]} />
    </div>
  );
}

export default function ChatbotDeskPage() {
  return <Suspense><Desk /></Suspense>;
}
