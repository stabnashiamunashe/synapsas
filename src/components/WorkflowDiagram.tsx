"use client";

import { useMemo } from "react";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled, MinusCircleOutlined, RollbackOutlined } from "@ant-design/icons";
import type { LevelDef } from "@/lib/types";
import { describeApprover, describeCondition, type UserOption } from "./LevelSettingsForm";
import { useApi } from "@/lib/client";

export type LevelState = "done" | "active" | "waiting" | "skipped" | "rejected" | "returned";

export interface DiagramApproval { levelOrder: number; status: string; approver: { name: string } }

const COLORS: Record<LevelState, { border: string; bg: string; text: string }> = {
  done: { border: "#2f855a", bg: "#e6f4ec", text: "#1f6b47" },
  active: { border: "var(--brand-color, #003B32)", bg: "#fff", text: "#1f2933" },
  waiting: { border: "#cbd2da", bg: "#fff", text: "#1f2933" },
  skipped: { border: "#d9dde3", bg: "#f5f6f8", text: "#8a94a6" },
  rejected: { border: "#c53030", bg: "#fdecec", text: "#9b2c2c" },
  returned: { border: "#c05621", bg: "#fff4e5", text: "#9c4221" },
};

type LevelNodeData = { level: LevelDef; state: LevelState; approvers: DiagramApproval[]; users?: UserOption[]; selected?: boolean; compact?: boolean };

function stateIcon(s: LevelState) {
  switch (s) {
    case "done": return <CheckCircleFilled style={{ color: "#2f855a" }} />;
    case "rejected": return <CloseCircleFilled style={{ color: "#c53030" }} />;
    case "returned": return <RollbackOutlined style={{ color: "#c05621" }} />;
    case "skipped": return <MinusCircleOutlined style={{ color: "#8a94a6" }} />;
    case "active": return <ClockCircleOutlined style={{ color: "var(--brand-color, #003B32)" }} />;
    default: return null;
  }
}

export function LevelNode({ data }: NodeProps<Node<LevelNodeData>>) {
  const c = COLORS[data.state];
  const cond = describeCondition(data.level);
  return (
    <div style={{
      width: 220, background: c.bg, borderStyle: "solid", borderColor: c.border, borderWidth: "1.5px 1.5px 1.5px 5px", borderRadius: 3, padding: "8px 10px", color: c.text,
      boxShadow: data.selected ? "0 0 0 3px rgba(0,59,50,0.18)" : data.state === "active" ? "0 6px 18px rgba(0,59,50,0.15)" : "none", fontSize: 12, fontFamily: "inherit",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: c.border, border: 0, width: 8, height: 8 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.level.order}. {data.level.name}</span>
        {stateIcon(data.state)}
      </div>
      <div style={{ color: data.state === "skipped" ? c.text : "#5f6b7a", marginTop: 2 }}>{describeApprover(data.level, data.users)}</div>
      {!data.compact && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
          <span style={{ border: "1px solid #d9dde3", padding: "0 5px", borderRadius: 2, fontSize: 10 }}>{data.level.mode === "ALL" ? "ALL" : "ANY"}</span>
          {data.level.slaHours ? <span style={{ border: "1px solid #d9dde3", padding: "0 5px", borderRadius: 2, fontSize: 10 }}>SLA {data.level.slaHours}h</span> : null}
          {cond && <span style={{ border: "1px dashed #8a94a6", padding: "0 5px", borderRadius: 2, fontSize: 10 }}>if {cond}</span>}
        </div>
      )}
      {data.approvers.length > 0 && (
        <div style={{ marginTop: 6, borderTop: "1px dashed #e5e8ec", paddingTop: 4 }}>
          {data.approvers.slice(0, 3).map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.approver.name}</span>
              <span style={{ color: "#5f6b7a", fontSize: 10 }}>{a.status.toLowerCase()}</span>
            </div>
          ))}
          {data.approvers.length > 3 && <div style={{ color: "#5f6b7a", fontSize: 10 }}>+{data.approvers.length - 3} more</div>}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: c.border, border: 0, width: 8, height: 8 }} />
      {/* loop-back handles (bottom) */}
      <Handle type="source" id="loop-out" position={Position.Bottom} style={{ background: "#c05621", border: 0, width: 6, height: 6, opacity: typeof data.level.returnTo === "number" ? 1 : 0 }} />
      <Handle type="target" id="loop-in" position={Position.Bottom} style={{ background: "#c05621", border: 0, width: 6, height: 6, left: "30%", opacity: 0 }} />
    </div>
  );
}

export function TerminalNode({ data }: NodeProps<Node<{ label: string; kind: "start" | "end"; state?: "done" | "waiting" | "rejected" }>>) {
  const done = data.state === "done";
  const bad = data.state === "rejected";
  return (
    <div style={{
      padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, fontFamily: "inherit",
      background: bad ? "#c53030" : done || data.kind === "start" ? "var(--brand-color, #003B32)" : "#fff",
      color: bad || done || data.kind === "start" ? "#fff" : "#5f6b7a", border: `1.5px solid ${bad ? "#c53030" : done || data.kind === "start" ? "var(--brand-color, #003B32)" : "#cbd2da"}`,
    }}>
      {data.kind === "end" && <Handle type="target" position={Position.Left} style={{ background: "#cbd2da", border: 0, width: 8, height: 8 }} />}
      {data.label}
      {data.kind === "start" && <Handle type="source" position={Position.Right} style={{ background: "var(--brand-color, #003B32)", border: 0, width: 8, height: 8 }} />}
    </div>
  );
}

export const nodeTypes = { level: LevelNode, terminal: TerminalNode };

export function levelState(l: LevelDef, opts: { activeLevels?: number[]; approvals?: DiagramApproval[]; currentLevel?: number; status?: string }): LevelState {
  const { activeLevels = [], approvals = [], currentLevel = 0, status } = opts;
  if (activeLevels.length && !activeLevels.includes(l.order)) return "skipped";
  const rows = approvals.filter((a) => a.levelOrder === l.order);
  if (rows.some((r) => r.status === "REJECTED")) return "rejected";
  if (rows.some((r) => r.status === "RETURNED")) return "returned";
  if (status === "APPROVED") return "done";
  if (l.order < currentLevel) return "done";
  if (l.order === currentLevel && status === "PENDING") return "active";
  if (rows.some((r) => r.status === "APPROVED") && !rows.some((r) => r.status === "PENDING")) return "done";
  return "waiting";
}

/** Horizontal layout: Start → L1 → L2 … → Approved. */
export function buildGraph(levels: LevelDef[], opts: {
  activeLevels?: number[]; approvals?: DiagramApproval[]; currentLevel?: number; status?: string; users?: UserOption[]; selectedOrder?: number; compact?: boolean;
}) {
  const sorted = [...levels].sort((a, b) => a.order - b.order);
  const gapX = 280, y = 40;
  const nodes: Node[] = [{ id: "start", type: "terminal", position: { x: 0, y: y + 22 }, data: { label: "Submitted", kind: "start" }, draggable: false, selectable: false }];
  let x = 150;
  for (const l of sorted) {
    const state = levelState(l, opts);
    nodes.push({ id: `L${l.order}`, type: "level", position: { x, y }, data: { level: l, state, approvers: (opts.approvals || []).filter((a) => a.levelOrder === l.order), users: opts.users, selected: opts.selectedOrder === l.order, compact: opts.compact } });
    x += gapX;
  }
  const endState = opts.status === "APPROVED" ? "done" : opts.status === "REJECTED" ? "rejected" : "waiting";
  nodes.push({ id: "end", type: "terminal", position: { x, y: y + 22 }, data: { label: opts.status === "REJECTED" ? "Rejected" : "Approved", kind: "end", state: endState }, draggable: false, selectable: false });
  const edges: Edge[] = [];
  const ids = ["start", ...sorted.map((l) => `L${l.order}`), "end"];
  for (let i = 0; i < ids.length - 1; i++) {
    const to = sorted[i]; // level that the edge leads into (undefined for the last edge)
    const cond = to ? describeCondition(to) : null;
    const skipped = to ? levelState(to, opts) === "skipped" : false;
    const done = i < sorted.length && sorted[i] && levelState(sorted[i], opts) === "done";
    edges.push({
      id: `e${i}`, source: ids[i], target: ids[i + 1], type: "smoothstep", animated: !!to && levelState(to, opts) === "active",
      label: cond ? `if ${cond}` : undefined, labelStyle: { fontSize: 10, fill: "#5f6b7a" }, labelBgStyle: { fill: "#fffdf0" },
      style: { stroke: skipped ? "#cbd2da" : done ? "#2f855a" : "#8a94a6", strokeWidth: 1.5, strokeDasharray: skipped || cond ? "5 4" : undefined },
    });
  }
  // Loop-back edges: a "return for changes" that re-runs an earlier level.
  for (const l of sorted) {
    if (typeof l.returnTo === "number" && l.returnTo < l.order && sorted.some((x) => x.order === l.returnTo)) {
      edges.push({
        id: `loop${l.order}`, source: `L${l.order}`, sourceHandle: "loop-out", target: `L${l.returnTo}`, targetHandle: "loop-in", type: "default",
        label: `return → L${l.returnTo}`, labelStyle: { fontSize: 10, fill: "#9c4221" }, labelBgStyle: { fill: "#fff4e5" },
        style: { stroke: "#c05621", strokeWidth: 1.5, strokeDasharray: "3 3" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#c05621" },
      });
    }
  }
  return { nodes, edges };
}

/** Read-only diagram of a workflow, optionally overlaid with a request's live state. */
export function WorkflowDiagram({ levels, activeLevels, approvals, currentLevel, status, users: usersProp, height = 220, compact }: {
  levels: LevelDef[]; activeLevels?: number[]; approvals?: DiagramApproval[]; currentLevel?: number; status?: string; users?: UserOption[]; height?: number; compact?: boolean;
}) {
  // Resolve named approvers to people when the caller did not supply a user list.
  const needsUsers = !usersProp && levels.some((l) => l.approverType === "USER");
  const { data: fetched } = useApi<UserOption[]>(needsUsers ? "/api/users?all=1" : null);
  const users = usersProp || fetched || undefined;
  const { nodes, edges } = useMemo(() => buildGraph(levels, { activeLevels, approvals, currentLevel, status, users, compact }), [levels, activeLevels, approvals, currentLevel, status, users, compact]);
  return (
    <div style={{ height, border: "1px solid #e5e8ec", borderRadius: 2, background: "#fbfbf7" }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} zoomOnScroll={false} panOnScroll proOptions={{ hideAttribution: true }} minZoom={0.3}>
        <Background gap={18} size={1} color="#e1e4e8" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
