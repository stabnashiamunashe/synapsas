"use client";

/**
 * Named icon set used for workflows, case categories and module tiles. Icons are referenced by name
 * (stored in `icon` fields) and rendered with Ant Design's outlined glyphs, so the interface never shows emoji.
 * Legacy emoji values from older data are mapped to the nearest named icon.
 */
import {
  AuditOutlined, BankOutlined, BarChartOutlined, BookOutlined, BuildOutlined, BulbOutlined, CalculatorOutlined, CalendarOutlined, CameraOutlined, CarOutlined,
  CarryOutOutlined, CloudOutlined, CommentOutlined, CompassOutlined, ContainerOutlined, CreditCardOutlined, CustomerServiceOutlined, DatabaseOutlined, DesktopOutlined,
  DollarOutlined, EnvironmentOutlined, ExperimentOutlined, FileDoneOutlined, FileProtectOutlined, FileTextOutlined, FlagOutlined, FolderOutlined, FormOutlined,
  FundOutlined, GlobalOutlined, HomeOutlined, IdcardOutlined, InsuranceOutlined, KeyOutlined, LaptopOutlined, LockOutlined, MailOutlined, MedicineBoxOutlined,
  MobileOutlined, NotificationOutlined, PhoneOutlined, PrinterOutlined, ProfileOutlined, ProjectOutlined, ReadOutlined, RocketOutlined, SafetyCertificateOutlined,
  ScheduleOutlined, SendOutlined, SettingOutlined, ShopOutlined, ShoppingCartOutlined, SolutionOutlined, SoundOutlined, TableOutlined, TagOutlined, TeamOutlined,
  ToolOutlined, TruckOutlined, WalletOutlined, WarningOutlined, WifiOutlined,
} from "@ant-design/icons";
import { Select } from "antd";
import type { ComponentType } from "react";

type IconDef = { label: string; Icon: ComponentType<{ style?: React.CSSProperties; className?: string }> };

export const ICONS: Record<string, IconDef> = {
  travel: { label: "Travel", Icon: CompassOutlined },
  receipt: { label: "Receipt / claim", Icon: FileDoneOutlined },
  clipboard: { label: "Application form", Icon: ProfileOutlined },
  leave: { label: "Leave", Icon: CalendarOutlined },
  schedule: { label: "Schedule", Icon: ScheduleOutlined },
  memo: { label: "Memo", Icon: FormOutlined },
  document: { label: "Document", Icon: FileTextOutlined },
  contract: { label: "Contract / policy", Icon: FileProtectOutlined },
  folder: { label: "Folder", Icon: FolderOutlined },
  vehicle: { label: "Vehicle", Icon: CarOutlined },
  truck: { label: "Truck / delivery", Icon: TruckOutlined },
  send: { label: "Dispatch", Icon: SendOutlined },
  cart: { label: "Purchase", Icon: ShoppingCartOutlined },
  shop: { label: "Supplier", Icon: ShopOutlined },
  payment: { label: "Payment", Icon: DollarOutlined },
  wallet: { label: "Wallet / advance", Icon: WalletOutlined },
  card: { label: "Card", Icon: CreditCardOutlined },
  calculator: { label: "Calculator", Icon: CalculatorOutlined },
  fund: { label: "Budget", Icon: FundOutlined },
  data: { label: "Statistics / data", Icon: BarChartOutlined },
  table: { label: "Table", Icon: TableOutlined },
  database: { label: "Database", Icon: DatabaseOutlined },
  publication: { label: "Publication", Icon: ReadOutlined },
  book: { label: "Book / manual", Icon: BookOutlined },
  laptop: { label: "Laptop / ICT", Icon: LaptopOutlined },
  desktop: { label: "Desktop", Icon: DesktopOutlined },
  mobile: { label: "Mobile / tablet", Icon: MobileOutlined },
  printer: { label: "Printer", Icon: PrinterOutlined },
  wifi: { label: "Network", Icon: WifiOutlined },
  cloud: { label: "Cloud / system", Icon: CloudOutlined },
  lock: { label: "Access / password", Icon: LockOutlined },
  key: { label: "Key", Icon: KeyOutlined },
  security: { label: "Security", Icon: SafetyCertificateOutlined },
  insurance: { label: "Insurance", Icon: InsuranceOutlined },
  building: { label: "Building / facilities", Icon: BankOutlined },
  home: { label: "Office", Icon: HomeOutlined },
  tool: { label: "Maintenance", Icon: ToolOutlined },
  build: { label: "Works", Icon: BuildOutlined },
  bulb: { label: "Utilities", Icon: BulbOutlined },
  megaphone: { label: "Complaint / notice", Icon: NotificationOutlined },
  sound: { label: "Announcement", Icon: SoundOutlined },
  comment: { label: "Feedback", Icon: CommentOutlined },
  support: { label: "Service desk", Icon: CustomerServiceOutlined },
  phone: { label: "Phone", Icon: PhoneOutlined },
  mail: { label: "Mail", Icon: MailOutlined },
  people: { label: "People / HR", Icon: TeamOutlined },
  idcard: { label: "Identity / staff", Icon: IdcardOutlined },
  solution: { label: "Case / solution", Icon: SolutionOutlined },
  audit: { label: "Audit", Icon: AuditOutlined },
  project: { label: "Project", Icon: ProjectOutlined },
  flag: { label: "Milestone", Icon: FlagOutlined },
  tag: { label: "Tag", Icon: TagOutlined },
  location: { label: "Location / field", Icon: EnvironmentOutlined },
  global: { label: "International", Icon: GlobalOutlined },
  camera: { label: "Camera / media", Icon: CameraOutlined },
  health: { label: "Health / medical", Icon: MedicineBoxOutlined },
  training: { label: "Training", Icon: ExperimentOutlined },
  rocket: { label: "Launch", Icon: RocketOutlined },
  settings: { label: "Settings", Icon: SettingOutlined },
  container: { label: "Stores / inventory", Icon: ContainerOutlined },
  done: { label: "Completed", Icon: CarryOutOutlined },
  warning: { label: "Incident", Icon: WarningOutlined },
};

/** Emoji values written by earlier versions, mapped to named icons so existing data renders cleanly. */
const LEGACY: Record<string, string> = {
  "🧳": "travel", "✈️": "travel", "🧾": "receipt", "📋": "clipboard", "🌴": "leave", "🏖️": "leave", "📅": "schedule", "📝": "memo", "📄": "document",
  "🚙": "vehicle", "🚗": "vehicle", "🚚": "truck", "🛒": "cart", "💵": "payment", "💰": "payment", "💳": "card", "📊": "data", "📈": "data", "📰": "publication",
  "💻": "laptop", "🖥️": "desktop", "📱": "mobile", "🖨️": "printer", "🔐": "lock", "🔑": "key", "🏢": "building", "🏠": "home", "🛠️": "tool", "🔧": "tool", "💡": "bulb",
  "📣": "megaphone", "📢": "sound", "💬": "comment", "🎧": "support", "📞": "phone", "✉️": "mail", "👥": "people", "🪪": "idcard", "📍": "location", "🌍": "global",
  "📷": "camera", "🏥": "health", "🎓": "training", "🚀": "rocket", "⚙️": "settings", "📦": "container", "✅": "done", "⚠️": "warning",
};

export function resolveIconName(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (ICONS[v]) return v;
  if (LEGACY[v]) return LEGACY[v];
  const stripped = v.replace(/️/g, "");
  for (const [emoji, name] of Object.entries(LEGACY)) if (emoji.replace(/️/g, "") === stripped) return name;
  return null;
}

/** Inline icon for a stored icon value. Renders nothing for unknown values. */
export function AppIcon({ name, style, className, fallback }: { name?: string | null; style?: React.CSSProperties; className?: string; fallback?: string }) {
  const key = resolveIconName(name) || (fallback ? resolveIconName(fallback) : null);
  if (!key) return null;
  const { Icon } = ICONS[key];
  return <Icon className={className} style={{ fontSize: 16, verticalAlign: "-0.125em", ...style }} aria-hidden />;
}

/** Icon in a square tile (used on workflow tiles and category lists). */
export function IconTile({ name, color, size = 36, fallback }: { name?: string | null; color?: string | null; size?: number; fallback?: string }) {
  const key = resolveIconName(name) || resolveIconName(fallback) || "document";
  const { Icon } = ICONS[key];
  const c = color || "var(--brand-color)";
  return (
    <span className="icon-tile" style={{ width: size, height: size, color: c, borderColor: c }} aria-hidden>
      <Icon style={{ fontSize: Math.round(size * 0.5) }} />
    </span>
  );
}

/** Dropdown for choosing a named icon. */
export function IconPicker({ value, onChange, style, placeholder = "Icon", allowClear = true }: { value?: string | null; onChange?: (v: string | undefined) => void; style?: React.CSSProperties; placeholder?: string; allowClear?: boolean }) {
  return (
    <Select
      value={resolveIconName(value) || undefined}
      onChange={(v) => onChange?.(v || undefined)}
      allowClear={allowClear}
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      style={style}
      options={Object.entries(ICONS).map(([k, d]) => ({ value: k, label: d.label, icon: <d.Icon /> }))}
      optionRender={(o) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{(o.data as { icon: React.ReactNode }).icon}{o.label}</span>}
      labelRender={(o) => { const key = String(o.value); const d = ICONS[key]; return d ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><d.Icon />{d.label}</span> : o.label; }}
    />
  );
}
