"use client";

import { App, Button, Input, Modal, Select, Space, Typography } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApi } from "@/lib/client";
import { CATEGORY_LABELS, type ApproverType, type LevelDef, type Role, type TemplateCategory } from "@/lib/types";
import { APPROVER_TYPES, type UserOption } from "./LevelSettingsForm";
import { PRESETS } from "./TemplateBuilder";
import { WorkflowDiagram } from "./WorkflowDiagram";

type Stage = { id: string; name: string; approverType: ApproverType; loopBack?: number; userIds?: string[]; role?: Role; departmentId?: string };

const DEFAULT_STAGES: Stage[] = [
  { id: nanoid(6), name: "Line manager approval", approverType: "REQUESTER_MANAGER" },
  { id: nanoid(6), name: "Department head sign-off", approverType: "DEPARTMENT_HEAD" },
];

/**
 * Create a workflow by typing stage names. Form fields come from the category preset;
 * everything can be refined afterwards in the full builder.
 */
export function QuickWorkflowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("REQUISITION");
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);
  const [saving, setSaving] = useState(false);
  const { data: users } = useApi<UserOption[]>(open ? "/api/users" : null);
  const { data: departments } = useApi<{ id: string; name: string }[]>(open ? "/api/departments" : null);

  const levels: LevelDef[] = stages.map((s, i) => ({
    id: s.id, order: i + 1, name: s.name || `Stage ${i + 1}`, approverType: s.approverType, mode: "ANY", slaHours: 48,
    allowDelegate: true, allowReturn: true, skipIfRequester: true,
    ...(s.approverType === "USER" ? { approverUserIds: s.userIds || [] } : {}),
    ...(s.approverType === "ROLE" ? { approverRole: s.role || "MANAGER" } : {}),
    ...(s.approverType === "DEPARTMENT" ? { departmentId: s.departmentId } : {}),
    ...(s.loopBack ? { returnTo: s.loopBack } : {}),
  }));

  const setStage = (i: number, patch: Partial<Stage>) => setStages((st) => st.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) => setStages((st) => { const j = i + dir; if (j < 0 || j >= st.length) return st; const n = [...st]; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const create = async () => {
    if (!name.trim()) return message.error("Give the workflow a name");
    if (stages.some((s) => !s.name.trim())) return message.error("Every stage needs a name");
    const missing = stages.findIndex((s) => s.approverType === "USER" && !(s.userIds && s.userIds.length));
    if (missing >= 0) return message.error(`Stage ${missing + 1} needs at least one named approver`);
    const noDept = stages.findIndex((s) => s.approverType === "DEPARTMENT" && !s.departmentId);
    if (noDept >= 0) return message.error(`Stage ${noDept + 1} needs a section`);
    setSaving(true);
    try {
      const preset = PRESETS[category] || {};
      const prefix = (preset.prefix || name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "REQ").toUpperCase();
      const t = await api<{ id: string }>("/api/templates", {
        method: "POST",
        json: {
          name: name.trim(), category, prefix, icon: preset.icon, color: preset.color,
          description: `${CATEGORY_LABELS[category]} workflow with ${stages.length} stage${stages.length === 1 ? "" : "s"}.`,
          fields: preset.fields || [{ key: "title", label: "Subject", type: "text", required: true, width: "full" }, { key: "details", label: "Details", type: "textarea", required: true, width: "full" }],
          levels, settings: { allowAttachments: true, ...(preset.settings || {}) }, isActive: true,
        },
      });
      message.success("Workflow created. Fine-tune approvers and fields in the builder.");
      onClose();
      router.push(`/app/templates/${t.id}`);
    } catch (e) {
      const err = e as { message: string; details?: { message: string }[] };
      message.error(err.details?.length ? err.details.map((d) => d.message).join(". ") : err.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onCancel={onClose} onOk={create} confirmLoading={saving} okText="Create workflow" title="New workflow from stages" width={860} destroyOnHidden>
      <Space orientation="vertical" style={{ width: "100%" }} size={14}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div><label className="muted">Workflow name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Travel request" autoFocus /></div>
          <div><label className="muted">Type (sets the form preset)</label><Select style={{ width: "100%" }} value={category} onChange={setCategory} options={(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} /></div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Typography.Text strong>Stages, in order</Typography.Text>
            <Button size="small" icon={<PlusOutlined />} onClick={() => setStages((st) => [...st, { id: nanoid(6), name: "", approverType: "REQUESTER_MANAGER" }])}>Add stage</Button>
          </div>
          {stages.map((s, i) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr 190px 170px auto", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: 13, background: "var(--brand-color)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
              <Input value={s.name} placeholder={`Stage ${i + 1} name`} onChange={(e) => setStage(i, { name: e.target.value })} />
              <Select value={s.approverType} onChange={(v) => setStage(i, { approverType: v })} options={APPROVER_TYPES.map((t) => ({ value: t.value, label: t.short }))} />
              <Select value={s.loopBack ?? 0} onChange={(v) => setStage(i, { loopBack: v || undefined })} disabled={i === 0}
                options={[{ value: 0, label: "Return → requester" }, ...stages.slice(0, i).map((p, j) => ({ value: j + 1, label: `Return → stage ${j + 1}` }))]} />
              <Space size={0}>
                <Button type="text" size="small" icon={<ArrowUpOutlined />} onClick={() => move(i, -1)} />
                <Button type="text" size="small" icon={<ArrowDownOutlined />} onClick={() => move(i, 1)} />
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setStages((st) => st.filter((_, idx) => idx !== i))} />
              </Space>
              {(s.approverType === "USER" || s.approverType === "ROLE" || s.approverType === "DEPARTMENT") && (
                <div style={{ gridColumn: "2 / span 3" }}>
                  {s.approverType === "DEPARTMENT" ? (
                    <Select showSearch optionFilterProp="label" placeholder="Which section acts at this stage?" style={{ width: "100%" }} value={s.departmentId} onChange={(departmentId) => setStage(i, { departmentId })}
                      options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} />
                  ) : s.approverType === "USER" ? (
                    <Select mode="multiple" showSearch optionFilterProp="label" placeholder="Choose the approver(s) for this stage" style={{ width: "100%" }} value={s.userIds || []} onChange={(userIds) => setStage(i, { userIds })}
                      options={(users || []).map((u) => ({ value: u.id, label: `${u.name} · ${u.role.toLowerCase()}` }))} />
                  ) : (
                    <Select placeholder="Which role approves?" style={{ width: "100%" }} value={s.role} onChange={(role) => setStage(i, { role })} options={["OWNER", "ADMIN", "MANAGER", "MEMBER"].map((r) => ({ value: r, label: `Any ${r.toLowerCase()}` }))} />
                  )}
                </div>
              )}
            </div>
          ))}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Approvers default to any-one-approves with a 48h SLA. Stages that use named users get their people assigned in the builder after creation.
          </Typography.Text>
        </div>

        <div>
          <Typography.Text strong>Preview</Typography.Text>
          <div style={{ marginTop: 6 }}><WorkflowDiagram levels={levels} height={170} compact /></div>
        </div>
      </Space>
    </Modal>
  );
}
