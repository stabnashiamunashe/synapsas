"use client";

import {
  ApartmentOutlined, ApiOutlined, AuditOutlined, RobotOutlined, BarChartOutlined, BranchesOutlined, CalendarOutlined, CarOutlined, ClockCircleOutlined, CustomerServiceOutlined,
  DashboardOutlined, FileTextOutlined, FolderOpenOutlined, GlobalOutlined, InboxOutlined, LaptopOutlined, NotificationOutlined, PlusOutlined, SafetyCertificateOutlined,
  ScheduleOutlined, SettingOutlined, SlidersOutlined, TagsOutlined, TeamOutlined, UserOutlined, WalletOutlined, WhatsAppOutlined,
} from "@ant-design/icons";

/** Icons for the navigation registry (src/lib/nav.ts). */
export const NAV_ICONS: Record<string, React.ReactNode> = {
  home: <DashboardOutlined />, inbox: <InboxOutlined />, clock: <ClockCircleOutlined />, chart: <BarChartOutlined />, plus: <PlusOutlined />, file: <FileTextOutlined />,
  folder: <FolderOpenOutlined />, calendar: <CalendarOutlined />, support: <CustomerServiceOutlined />, tags: <TagsOutlined />, whatsapp: <WhatsAppOutlined />, sliders: <SlidersOutlined />,
  notification: <NotificationOutlined />, schedule: <ScheduleOutlined />, wallet: <WalletOutlined />, laptop: <LaptopOutlined />, car: <CarOutlined />, branches: <BranchesOutlined />,
  team: <TeamOutlined />, apartment: <ApartmentOutlined />, audit: <AuditOutlined />, setting: <SettingOutlined />, safety: <SafetyCertificateOutlined />, api: <ApiOutlined />,
  user: <UserOutlined />, global: <GlobalOutlined />, robot: <RobotOutlined />,
};

export function NavIcon({ name }: { name: string }) {
  return <>{NAV_ICONS[name] || <FileTextOutlined />}</>;
}
