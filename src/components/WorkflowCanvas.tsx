"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Node, type NodeMouseHandler, applyNodeChanges, type NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button, Drawer, Empty, Popconfirm, Space, Typography } from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { nanoid } from "nanoid";
import type { FieldDef, LevelDef } from "@/lib/types";
import { buildGraph, nodeTypes } from "./WorkflowDiagram";
import { LevelSettingsForm, type UserOption } from "./LevelSettingsForm";
import { useApi } from "@/lib/client";

const renumber = (ls: LevelDef[]) => ls.map((l, i) => ({ ...l, order: i + 1 }));

/**
 * Drag-and-drop workflow canvas. Levels are nodes in a left-to-right chain; drag a node past its neighbour to
 * reorder, click a node to edit it in a side panel, add levels from the toolbar or the "+" on the last node.
 */
export function WorkflowCanvas({ levels, fields, onChange, height = 420 }: { levels: LevelDef[]; fields: FieldDef[]; onChange: (l: LevelDef[]) => void; height?: number }) {
  const { data: users } = useApi<UserOption[]>("/api/users");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const graph = useMemo(() => buildGraph(levels, { users: users || undefined, selectedOrder: selectedOrder ?? undefined }), [levels, users, selectedOrder]);
  const [nodes, setNodes] = useState<Node[]>(graph.nodes);
  useEffect(() => setNodes(graph.nodes), [graph.nodes]);

  const sorted = useMemo(() => [...levels].sort((a, b) => a.order - b.order), [levels]);
  const selected = sorted.find((l) => l.order === selectedOrder) || null;

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)), []);
  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === "level") setSelectedOrder((node.data as { level: LevelDef }).level.order);
  }, []);
  /** Reorder by horizontal position once a drag finishes. */
  const onNodeDragStop = useCallback(() => {
    setNodes((current) => {
      const levelNodes = current.filter((n) => n.type === "level").sort((a, b) => a.position.x - b.position.x);
      const byId = new Map(sorted.map((l) => [`L${l.order}`, l]));
      const reordered = renumber(levelNodes.map((n) => byId.get(n.id)!).filter(Boolean));
      const changed = reordered.some((l, i) => l.id !== sorted[i]?.id);
      if (changed) {
        onChange(reordered);
        setSelectedOrder(null);
      }
      return current;
    });
  }, [sorted, onChange]);

  const add = () => {
    const nl: LevelDef = { id: nanoid(8), order: levels.length + 1, name: `Level ${levels.length + 1}`, approverType: "REQUESTER_MANAGER", mode: "ANY", allowDelegate: true, allowReturn: true, skipIfRequester: true, slaHours: 48 };
    onChange(renumber([...sorted, nl]));
    setSelectedOrder(levels.length + 1);
  };
  const update = (patch: Partial<LevelDef>) => {
    if (!selected) return;
    onChange(sorted.map((l) => (l.id === selected.id ? { ...l, ...patch } : l)));
  };
  const remove = () => {
    if (!selected) return;
    onChange(renumber(sorted.filter((l) => l.id !== selected.id)));
    setSelectedOrder(null);
  };
  const move = (dir: -1 | 1) => {
    if (!selected) return;
    const i = sorted.findIndex((l) => l.id === selected.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(renumber(next));
    setSelectedOrder(j + 1);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <Typography.Text type="secondary">Click a level to edit it. Drag a level left or right to reorder. Dashed edges are conditional.</Typography.Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={add}>Add level</Button>
      </div>
      <div style={{ height, border: "1px solid #d9dde3", borderRadius: 2, background: "#fbfbf7", position: "relative" }}>
        {levels.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, pointerEvents: "none" }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No levels yet. Add one to start the chain; with no levels, requests auto-approve." />
          </div>
        )}
        <ReactFlow nodes={nodes} edges={graph.edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={onNodeClick} onNodeDragStop={onNodeDragStop}
          fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} nodesConnectable={false} proOptions={{ hideAttribution: true }} minZoom={0.3} panOnScroll>
          <Background gap={18} size={1} color="#e1e4e8" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable style={{ height: 70, width: 120 }} nodeColor={() => "#003B32"} />
        </ReactFlow>
      </div>

      <Drawer open={!!selected} onClose={() => setSelectedOrder(null)} size="large" title={selected ? `Level ${selected.order} · ${selected.name}` : ""} destroyOnHidden
        extra={selected && (
          <Space>
            <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => move(-1)} disabled={selected.order === 1}>Earlier</Button>
            <Button size="small" icon={<ArrowRightOutlined />} onClick={() => move(1)} disabled={selected.order === sorted.length}>Later</Button>
            <Popconfirm title="Remove this level?" onConfirm={remove}><Button size="small" danger icon={<DeleteOutlined />}>Remove</Button></Popconfirm>
          </Space>
        )}>
        {selected && <LevelSettingsForm level={selected} fields={fields} users={users || undefined} levels={sorted} onChange={update} />}
      </Drawer>
    </div>
  );
}
