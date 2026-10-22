"use client";

import { Button, Card, Col, Empty, Row, Space, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { nanoid } from "nanoid";
import { useState } from "react";
import type { FieldDef, LevelDef } from "@/lib/types";
import { APPROVER_TYPES, LevelSettingsForm, type UserOption } from "./LevelSettingsForm";
import { useApi } from "@/lib/client";

/** List-style level editor (the canvas is the visual alternative; both edit the same data). */
export function LevelsEditor({ levels, fields, onChange }: { levels: LevelDef[]; fields: FieldDef[]; onChange: (l: LevelDef[]) => void }) {
  const [selected, setSelected] = useState(0);
  const { data: users } = useApi<UserOption[]>("/api/users");
  const l = levels[selected];
  const update = (patch: Partial<LevelDef>) => onChange(levels.map((x, i) => (i === selected ? { ...x, ...patch } : x)));
  const add = () => {
    const nl: LevelDef = { id: nanoid(8), order: levels.length + 1, name: `Level ${levels.length + 1}`, approverType: "REQUESTER_MANAGER", mode: "ANY", allowDelegate: true, allowReturn: true, skipIfRequester: true, slaHours: 48 };
    onChange([...levels, nl]);
    setSelected(levels.length);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= levels.length) return;
    const next = [...levels];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((x, idx) => ({ ...x, order: idx + 1 })));
    setSelected(j);
  };
  const remove = (i: number) => { onChange(levels.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, order: idx + 1 }))); setSelected(Math.max(0, i - 1)); };

  return (
    <Row gutter={16}>
      <Col xs={24} md={10}>
        <Button icon={<PlusOutlined />} onClick={add} style={{ marginBottom: 8 }}>Add level</Button>
        {levels.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No levels: requests are auto-approved on submit." />}
        {levels.map((x, i) => (
          <div key={x.id} className={`level-card ${i === selected ? "active" : ""}`} onClick={() => setSelected(i)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: "var(--brand-color)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text strong>{x.name}</Typography.Text>
              <div className="muted" style={{ fontSize: 12 }}>
                {APPROVER_TYPES.find((t) => t.value === x.approverType)?.label} · {x.mode === "ALL" ? "all" : "any"}
                {x.slaHours ? ` · ${x.slaHours}h SLA` : ""}{x.condition ? " · conditional" : ""}
              </div>
            </div>
            <Space size={0}>
              <Button type="text" size="small" icon={<ArrowUpOutlined />} onClick={(e) => { e.stopPropagation(); move(i, -1); }} />
              <Button type="text" size="small" icon={<ArrowDownOutlined />} onClick={(e) => { e.stopPropagation(); move(i, 1); }} />
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); remove(i); }} />
            </Space>
          </div>
        ))}
      </Col>
      <Col xs={24} md={14}>
        {!l ? <Card><Typography.Text type="secondary">Select a level to configure who approves and how.</Typography.Text></Card> : (
          <Card title={`Level ${selected + 1} · ${l.name}`} size="small">
            <LevelSettingsForm level={l} fields={fields} users={users || undefined} levels={levels} onChange={update} />
          </Card>
        )}
      </Col>
    </Row>
  );
}
