"use client";

import { App, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Skeleton, Space, Table, Tabs, Tag, Typography } from "antd";
import { CarOutlined, CheckCircleOutlined, PlusOutlined, ToolOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { api, formatDate, useApi, useMe } from "@/lib/client";
import { ROLE_RANK } from "@/lib/roles";

interface Vehicle { id: string; registration: string; make?: string | null; model?: string | null; type: string; status: string; odometer: number; department?: { id: string; name: string } | null; notes?: string | null; nextTrip?: { id: string; destination: string; startsAt: string; endsAt: string; status: string } | null; free?: boolean }
interface Trip { id: string; destination: string; purpose: string; passengers: number; startsAt: string; endsAt: string; status: string; odometerStart?: number | null; odometerEnd?: number | null; fuelLitres?: number | null; notes?: string | null; vehicle?: { id: string; registration: string; make?: string | null; model?: string | null } | null; driver?: { id: string; name: string } | null; requester: { id: string; name: string; department?: { name: string } | null }; project?: { id: string; code: string } | null; request?: { id: string; referenceNo: string } | null }

const V_STATUS: Record<string, { label: string; color: string }> = { AVAILABLE: { label: "Available", color: "green" }, IN_USE: { label: "On a trip", color: "blue" }, MAINTENANCE: { label: "Maintenance", color: "gold" }, RETIRED: { label: "Retired", color: "default" } };
const T_STATUS: Record<string, { label: string; color: string }> = { PLANNED: { label: "Needs vehicle", color: "gold" }, ASSIGNED: { label: "Assigned", color: "blue" }, ONGOING: { label: "On the road", color: "purple" }, COMPLETED: { label: "Completed", color: "green" }, CANCELLED: { label: "Cancelled", color: "default" } };

export default function FleetPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const isManager = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.MANAGER : false;
  const isAdmin = me ? ROLE_RANK[me.user.role] >= ROLE_RANK.ADMIN : false;
  const [tripFilter, setTripFilter] = useState<"active" | "all">("active");
  const { data: vehicles, mutate: mutateV } = useApi<Vehicle[]>("/api/fleet/vehicles");
  const { data: trips, isLoading, mutate: mutateT } = useApi<Trip[]>(tripFilter === "active" ? "/api/fleet/trips?status=PLANNED,ASSIGNED,ONGOING" : "/api/fleet/trips");
  const { data: users } = useApi<{ id: string; name: string }[]>(isManager ? "/api/users?active=1" : null);
  const { data: departments } = useApi<{ id: string; name: string }[]>(isManager ? "/api/departments" : null);
  const { data: projects } = useApi<{ id: string; code: string; name: string }[]>(isManager ? "/api/projects" : null);
  const [assigning, setAssigning] = useState<Trip | null>(null);
  const { data: freeVehicles } = useApi<Vehicle[]>(assigning ? `/api/fleet/vehicles?from=${encodeURIComponent(assigning.startsAt)}&to=${encodeURIComponent(assigning.endsAt)}&excludeTripId=${assigning.id}` : null);
  const [acting, setActing] = useState<{ trip: Trip; action: "start" | "complete" | "cancel" } | null>(null);
  const [editingV, setEditingV] = useState<Vehicle | "new" | null>(null);
  const [booking, setBooking] = useState(false);
  const [assignForm] = Form.useForm();
  const [actForm] = Form.useForm();
  const [vForm] = Form.useForm();
  const [bookForm] = Form.useForm();

  const run = async (fn: () => Promise<unknown>, done: string) => { try { await fn(); message.success(done); mutateT(); mutateV(); return true; } catch (e) { message.error((e as Error).message); return false; } };
  const assign = async () => { const v = await assignForm.validateFields(); if (await run(() => api(`/api/fleet/trips/${assigning!.id}`, { method: "POST", json: { action: "assign", ...v } }), "Vehicle assigned")) setAssigning(null); };
  const act = async () => { const v = await actForm.validateFields(); if (await run(() => api(`/api/fleet/trips/${acting!.trip.id}`, { method: "POST", json: { action: acting!.action, ...v } }), "Updated")) setActing(null); };
  const saveV = async () => {
    const v = await vForm.validateFields();
    const okk = await run(() => editingV === "new" ? api("/api/fleet/vehicles", { method: "POST", json: v }) : api(`/api/fleet/vehicles/${(editingV as Vehicle).id}`, { method: "PATCH", json: v }), "Saved");
    if (okk) setEditingV(null);
  };
  const book = async () => {
    const v = await bookForm.validateFields();
    const json = { ...v, startsAt: v.range[0].toISOString(), endsAt: v.range[1].toISOString(), range: undefined };
    if (await run(() => api("/api/fleet/trips", { method: "POST", json }), "Trip booked")) setBooking(false);
  };

  const needVehicle = (trips || []).filter((t) => t.status === "PLANNED").length;
  const onRoad = (vehicles || []).filter((v) => v.status === "IN_USE").length;
  const available = (vehicles || []).filter((v) => v.status === "AVAILABLE").length;
  const maint = (vehicles || []).filter((v) => v.status === "MAINTENANCE").length;

  const tripCols = [
    { title: "When", width: 170, render: (_: unknown, t: Trip) => <span>{formatDate(t.startsAt)}{dayjs(t.endsAt).isSame(t.startsAt, "day") ? "" : ` – ${formatDate(t.endsAt)}`}</span> },
    { title: "Destination / purpose", render: (_: unknown, t: Trip) => <span><b>{t.destination}</b>{t.project && <Tag style={{ marginLeft: 6 }}>{t.project.code}</Tag>}<div className="muted" style={{ fontSize: 12 }}>{t.purpose}{t.request ? <> · <Link href={`/app/requests/${t.request.id}`}>{t.request.referenceNo}</Link></> : null}</div></span> },
    { title: "Requested by", render: (_: unknown, t: Trip) => <span>{t.requester.name}<div className="muted" style={{ fontSize: 12 }}>{t.requester.department?.name} · {t.passengers} pax</div></span> },
    { title: "Vehicle / driver", render: (_: unknown, t: Trip) => t.vehicle ? <span><b>{t.vehicle.registration}</b> <span className="muted">{[t.vehicle.make, t.vehicle.model].filter(Boolean).join(" ")}</span><div className="muted" style={{ fontSize: 12 }}>{t.driver?.name || "Self-drive"}</div></span> : <span className="muted">not assigned</span> },
    { title: "Status", width: 130, render: (_: unknown, t: Trip) => <Tag color={T_STATUS[t.status]?.color}>{T_STATUS[t.status]?.label || t.status}</Tag> },
    { title: "Km", width: 90, align: "right" as const, render: (_: unknown, t: Trip) => t.odometerEnd != null && t.odometerStart != null ? `${t.odometerEnd - t.odometerStart}` : "" },
    { title: "", width: 190, render: (_: unknown, t: Trip) => {
      const office = isManager, driver = t.driver?.id === me?.user.id, requester = t.requester.id === me?.user.id;
      return <Space wrap size={4}>
        {office && ["PLANNED", "ASSIGNED"].includes(t.status) && <a onClick={() => { setAssigning(t); assignForm.setFieldsValue({ vehicleId: t.vehicle?.id, driverUserId: t.driver?.id }); }}>{t.status === "PLANNED" ? "Assign" : "Reassign"}</a>}
        {(office || driver) && t.status === "ASSIGNED" && <a onClick={() => { setActing({ trip: t, action: "start" }); actForm.setFieldsValue({ odometerStart: vehicles?.find((v) => v.id === t.vehicle?.id)?.odometer }); }}>Start</a>}
        {(office || driver) && ["ASSIGNED", "ONGOING"].includes(t.status) && <a onClick={() => { setActing({ trip: t, action: "complete" }); actForm.resetFields(); }}>Complete</a>}
        {(office || requester) && !["COMPLETED", "CANCELLED"].includes(t.status) && <Popconfirm title="Cancel this trip?" onConfirm={() => run(() => api(`/api/fleet/trips/${t.id}`, { method: "POST", json: { action: "cancel" } }), "Cancelled")}><a style={{ color: "#c53030" }}>Cancel</a></Popconfirm>}
      </Space>;
    } },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title">Fleet & trips</Typography.Title>
          <div className="muted">Vehicle requests approved through the workflow land here for the transport office to assign a vehicle and driver. Odometer and fuel are captured per trip.</div>
        </div>
        <Space wrap>
          {isManager && <Button icon={<PlusOutlined />} onClick={() => { setBooking(true); bookForm.resetFields(); }}>Book directly</Button>}
          {isManager && <Button type="primary" icon={<CarOutlined />} onClick={() => { setEditingV("new"); vForm.resetFields(); vForm.setFieldsValue({ type: "Double cab", status: "AVAILABLE", odometer: 0 }); }}>Add vehicle</Button>}
        </Space>
      </div>
      {isManager && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><StatCard tone="orange" icon={<CarOutlined />} value={needVehicle} label="Trips needing a vehicle" /></Col>
          <Col xs={12} md={6}><StatCard tone="green" icon={<CheckCircleOutlined />} value={available} label="Vehicles available" /></Col>
          <Col xs={12} md={6}><StatCard tone="blue" icon={<CarOutlined />} value={onRoad} label="On the road" /></Col>
          <Col xs={12} md={6}><StatCard tone="grey" icon={<ToolOutlined />} value={maint} label="In maintenance" /></Col>
        </Row>
      )}
      <Tabs items={[
        { key: "trips", label: "Trips", children: (
          <Card extra={<Select value={tripFilter} onChange={setTripFilter} style={{ width: 160 }} options={[{ value: "active", label: "Active" }, { value: "all", label: "All, incl. completed" }]} />} title={isManager ? "Bookings" : "My trips"}>
            {isLoading || !trips ? <Skeleton active /> : trips.length === 0 ? <Empty description={isManager ? "No trips in this view. Approved vehicle requests appear here automatically." : "You have no trips. Submit a Vehicle request to book one."} /> : <Table<Trip> rowKey="id" dataSource={trips} size="small" pagination={{ pageSize: 25, hideOnSinglePage: true }} scroll={{ x: 1000 }} columns={tripCols} />}
          </Card>
        ) },
        { key: "vehicles", label: `Vehicles (${vehicles?.length || 0})`, children: (
          <Card>
            {!vehicles ? <Skeleton active /> : vehicles.length === 0 ? <Empty description="No vehicles on the fleet list yet" /> : (
              <Table<Vehicle> rowKey="id" dataSource={vehicles} size="small" pagination={false} scroll={{ x: 800 }} columns={[
                { title: "Registration", width: 140, render: (_, v) => <b className="mono">{v.registration}</b> },
                { title: "Vehicle", render: (_, v) => <span>{[v.make, v.model].filter(Boolean).join(" ") || "–"}<div className="muted" style={{ fontSize: 12 }}>{v.type}{v.department ? ` · ${v.department.name}` : ""}</div></span> },
                { title: "Status", width: 120, render: (_, v) => <Tag color={V_STATUS[v.status]?.color}>{V_STATUS[v.status]?.label || v.status}</Tag> },
                { title: "Odometer", width: 110, align: "right", render: (_, v) => `${v.odometer.toLocaleString()} km` },
                { title: "Next trip", render: (_, v) => v.nextTrip ? <span>{v.nextTrip.destination} <span className="muted">· {formatDate(v.nextTrip.startsAt)}</span></span> : <span className="muted">–</span> },
                ...(isManager ? [{ title: "", width: 120, render: (_: unknown, v: Vehicle) => <Space><a onClick={() => { setEditingV(v); vForm.resetFields(); vForm.setFieldsValue({ ...v, departmentId: v.department?.id }); }}>Edit</a>{isAdmin && <Popconfirm title="Retire this vehicle?" onConfirm={() => run(() => api(`/api/fleet/vehicles/${v.id}`, { method: "DELETE" }), "Retired")}><a style={{ color: "#c53030" }}>Retire</a></Popconfirm>}</Space> }] : []),
              ]} />
            )}
          </Card>
        ) },
      ]} />

      <Modal open={!!assigning} title={assigning ? `Assign vehicle · ${assigning.destination}` : ""} onCancel={() => setAssigning(null)} onOk={assign} okText="Assign" destroyOnHidden>
        {assigning && <Typography.Paragraph type="secondary">{formatDate(assigning.startsAt)} – {formatDate(assigning.endsAt)} · {assigning.passengers} passenger{assigning.passengers === 1 ? "" : "s"} · {assigning.requester.name}. Vehicles already booked in this window are greyed out.</Typography.Paragraph>}
        <Form form={assignForm} layout="vertical">
          <Form.Item name="vehicleId" label="Vehicle" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={(freeVehicles || []).map((v) => ({ value: v.id, disabled: !v.free, label: `${v.registration} · ${[v.make, v.model].filter(Boolean).join(" ")}${v.free ? "" : " (booked)"}` }))} /></Form.Item>
          <Form.Item name="driverUserId" label="Driver (leave empty for self-drive)"><Select allowClear showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={!!acting} title={acting ? (acting.action === "start" ? "Start trip" : "Complete trip") : ""} onCancel={() => setActing(null)} onOk={act} okText="Record" destroyOnHidden>
        <Form form={actForm} layout="vertical">
          {acting?.action === "start" && <Form.Item name="odometerStart" label="Odometer at departure (km)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: 200 }} /></Form.Item>}
          {acting?.action === "complete" && <>
            <Form.Item name="odometerEnd" label="Odometer on return (km)" rules={[{ required: true }]}><InputNumber min={acting.trip.odometerStart || 0} style={{ width: 200 }} /></Form.Item>
            <Form.Item name="fuelLitres" label="Fuel drawn (litres)"><InputNumber min={0} step={0.5} style={{ width: 200 }} /></Form.Item>
            <Form.Item name="notes" label="Notes (faults, incidents)"><Input.TextArea autoSize={{ minRows: 2 }} /></Form.Item>
          </>}
        </Form>
      </Modal>

      <Modal open={!!editingV} title={editingV === "new" ? "Add vehicle" : "Edit vehicle"} onCancel={() => setEditingV(null)} onOk={saveV} okText="Save" destroyOnHidden>
        <Form form={vForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="registration" label="Registration" rules={[{ required: true, min: 2 }]}><Input placeholder="e.g. GZ 1234" /></Form.Item></Col>
            <Col span={12}><Form.Item name="type" label="Type"><Select options={["Double cab", "Single cab", "SUV / 4x4", "Sedan", "Minibus", "Truck", "Motorcycle"].map((x) => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="make" label="Make"><Input placeholder="Toyota" /></Form.Item></Col>
            <Col span={12}><Form.Item name="model" label="Model"><Input placeholder="Hilux" /></Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="Status"><Select options={Object.entries(V_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="odometer" label="Odometer (km)"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="departmentId" label="Allocated to section (optional)"><Select allowClear showSearch optionFilterProp="label" options={(departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="Notes (service due, insurance, defects)"><Input.TextArea autoSize={{ minRows: 2 }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal open={booking} title="Book a trip directly" onCancel={() => setBooking(false)} onOk={book} okText="Book" destroyOnHidden>
        <Typography.Paragraph type="secondary">For the transport office. Officers should submit a Vehicle request so the Head of Section approves it first.</Typography.Paragraph>
        <Form form={bookForm} layout="vertical">
          <Form.Item name="destination" label="Destination" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
          <Form.Item name="purpose" label="Purpose" rules={[{ required: true, min: 2 }]}><Input /></Form.Item>
          <Form.Item name="range" label="From – to" rules={[{ required: true }]}><DatePicker.RangePicker showTime={{ format: "HH:mm" }} format="D MMM YYYY HH:mm" style={{ width: "100%" }} /></Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="passengers" label="Passengers" initialValue={1}><InputNumber min={1} max={60} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={16}><Form.Item name="projectId" label="Project (optional)"><Select allowClear showSearch optionFilterProp="label" options={(projects || []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} /></Form.Item></Col>
          </Row>
          <Form.Item name="requesterId" label="On behalf of"><Select allowClear showSearch optionFilterProp="label" options={(users || []).map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
