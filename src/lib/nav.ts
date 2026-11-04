/**
 * Single registry of every page in the application. The sidebar, the command palette (search) and the
 * documentation all derive from this list, so a page cannot exist without being reachable and searchable.
 */
import type { Role } from "./types";

export type NavGroup = "Overview" | "Requests & approvals" | "Licensing" | "Service desk" | "Staff & notices" | "Resources" | "Workflow design" | "Administration" | "Account" | "Public pages";

export interface NavItem {
  /** route; also the stable key */
  key: string;
  label: string;
  /** name in NAV_ICONS (AppShell) */
  icon: string;
  group: NavGroup;
  /** minimum role; omitted = everyone */
  minRole?: Role;
  /** one line shown in search results */
  description?: string;
  /** extra words that should match in search */
  keywords?: string;
  /** opens in a new tab (public pages) */
  external?: boolean;
  /** searchable but not listed in the sidebar (sub-pages, account pages) */
  sidebar?: boolean;
  /** route prefix used to highlight the item; defaults to key */
  match?: string;
}

export const NAV_GROUP_ORDER: NavGroup[] = ["Overview", "Requests & approvals", "Licensing", "Service desk", "Staff & notices", "Resources", "Workflow design", "Administration", "Account", "Public pages"];

export const NAV: NavItem[] = [
  // Overview
  { key: "/app", label: "Home", icon: "home", group: "Overview", description: "What is waiting on you, recent activity and quick actions", keywords: "dashboard start" , match: "/app$" },
  { key: "/app/inbox", label: "Inbox", icon: "inbox", group: "Overview", description: "Approvals waiting for your decision", keywords: "approve pending decisions" },
  { key: "/app/notifications", label: "Activity", icon: "clock", group: "Overview", description: "Notifications and recent events", keywords: "alerts history" },
  { key: "/app/reports", label: "Reports", icon: "chart", group: "Overview", minRole: "MANAGER", description: "Volumes, approval rates, cycle times and spend by project", keywords: "analytics statistics kpi" },

  // Requests & approvals
  { key: "/app/requests/new", label: "New request", icon: "plus", group: "Requests & approvals", description: "Start a T&S advance, claim, leave application, memo, payment or vehicle request", keywords: "create submit form tsa tsc leave memo vehicle" },
  { key: "/app/requests", label: "Requests", icon: "file", group: "Requests & approvals", description: "All requests you raised, approved or can see", keywords: "my requests list track status", match: "/app/requests(?!/new)" },
  { key: "/app/projects", label: "Projects & votes", icon: "folder", group: "Requests & approvals", description: "Devolution projects and budget votes: budgets and spend per programme", keywords: "programme budget vote cost centre devolution" },
  { key: "/app/settings/delegations", label: "Out of office", icon: "calendar", group: "Requests & approvals", description: "Delegate your approvals while you are away", keywords: "delegation leave cover absence" },

  // Licensing (local authority licences and permits)
  { key: "/app/licences", label: "Licence register", icon: "licence", group: "Licensing", description: "Shop, liquor, hawker, health and building licences: applications, inspections, fees, certificates, renewals", keywords: "licensing permits shop liquor hawker trading business certificate renewal inspection expiry", match: "/app/licences(?!/new|/types)" },
  { key: "/app/licences/new", label: "New licence application", icon: "plus", group: "Licensing", description: "Log an application received over the counter or by email", keywords: "apply licence permit application" },
  { key: "/app/licences/types", label: "Licence types & fees", icon: "tags", group: "Licensing", minRole: "ADMIN", description: "Schedule of licences, fees, validity and required documents", keywords: "fees tariff schedule licence catalogue" },

  // Service desk
  { key: "/app/cases", label: "Cases", icon: "support", group: "Service desk", description: "Service desk board and table: tickets, complaints and data requests", keywords: "tickets issues board kanban helpdesk", match: "/app/cases(?!/new|/categories)" },
  { key: "/app/cases/new", label: "Log a case", icon: "plus", group: "Service desk", description: "Raise a ticket on behalf of a member of the public or a colleague", keywords: "new ticket report issue" },
  { key: "/app/cases/categories", label: "Categories & SLAs", icon: "tags", group: "Service desk", minRole: "ADMIN", description: "Case categories, owning sections and service targets", keywords: "sla targets routing" },
  { key: "/app/settings/whatsapp", label: "WhatsApp channel", icon: "whatsapp", group: "Service desk", minRole: "ADMIN", description: "Meta Business API connection, templates, sandbox simulator and message log", keywords: "whatsapp mock simulator sandbox meta bot chat" },
  { key: "/app/settings/service-desk", label: "Portal & desk settings", icon: "sliders", group: "Service desk", minRole: "ADMIN", description: "Reference prefix, auto-assignment, board columns and the public portal text", keywords: "portal settings triage assignment" },

  // Staff & notices
  { key: "/app/notices", label: "Notice board", icon: "notification", group: "Staff & notices", description: "Circulars, policies and announcements with acknowledgements", keywords: "circular policy announcement memo acknowledge" },
  { key: "/app/leave", label: "Leave calendar", icon: "schedule", group: "Staff & notices", description: "Who is away, public holidays and the leave register", keywords: "holiday register absence roster" },

  // Resources
  { key: "/app/advances", label: "Advances ledger", icon: "wallet", group: "Resources", description: "T&S advance accounts, clearances, refunds and recoveries", keywords: "advance account balance finance clearance overdue" },
  { key: "/app/assets", label: "Asset register", icon: "laptop", group: "Resources", description: "Equipment, holders, movements, repairs and warranties", keywords: "equipment inventory laptop tablet gps issue return" },
  { key: "/app/fleet", label: "Fleet & trips", icon: "car", group: "Resources", description: "Vehicles, trip bookings, drivers, odometer and fuel", keywords: "vehicle transport booking driver trip" },

  // Workflow design (administrators)
  { key: "/app/templates", label: "Workflow designs", icon: "branches", group: "Workflow design", minRole: "ADMIN", description: "All approval workflows: fields, levels, conditions and versions", keywords: "templates forms builder designer approval levels", match: "/app/templates(?!/new)" },
  { key: "/app/templates/new", label: "Create workflow", icon: "plus", group: "Workflow design", minRole: "ADMIN", description: "Full builder: design a new form and its approval route", keywords: "new template custom workflow builder designer create" },

  // Administration
  { key: "/app/users", label: "People", icon: "team", group: "Administration", minRole: "ADMIN", description: "Staff accounts, roles, line managers, invitations", keywords: "users staff accounts invite roles" },
  { key: "/app/departments", label: "Departments", icon: "apartment", group: "Administration", minRole: "ADMIN", description: "Council structure and heads of department", keywords: "departments sections units heads" },
  { key: "/app/audit", label: "Audit log", icon: "audit", group: "Administration", minRole: "ADMIN", description: "Immutable record of every action, sign-in and change", keywords: "security log trail compliance" },
  { key: "/app/settings/branding", label: "Settings", icon: "setting", group: "Administration", minRole: "ADMIN", description: "Branding, organisation, security, portal, WhatsApp, API", keywords: "configuration preferences", match: "/app/settings(?!/delegations|/whatsapp|/service-desk)" },
  { key: "/app/settings/organization", label: "Organisation & security", icon: "safety", group: "Administration", minRole: "ADMIN", sidebar: false, description: "Name, currency, password and session rules, leave entitlement, public holidays", keywords: "security policy holidays entitlement lockout 2fa" },
  { key: "/app/settings/api", label: "API & webhooks", icon: "api", group: "Administration", minRole: "ADMIN", sidebar: false, description: "API keys and signed webhooks for integrations", keywords: "integration keys webhook finance system" },

  // Account
  { key: "/app/profile", label: "My profile", icon: "user", group: "Account", sidebar: false, description: "Name, job title, phone, avatar and notification preferences", keywords: "account me" },
  { key: "/app/profile?tab=security", label: "Security & two-factor", icon: "safety", group: "Account", sidebar: false, description: "Change password, enable two-factor authentication, sign out other devices", keywords: "password 2fa mfa authenticator sessions" },

  // Public pages
  { key: "/report", label: "Public portal: report an issue", icon: "global", group: "Public pages", sidebar: false, external: true, description: "What members of the public see when they log a case", keywords: "public form citizen portal" },
  { key: "/apply", label: "Public portal: apply for a licence", icon: "global", group: "Public pages", sidebar: false, external: true, description: "Citizen self-service: choose a licence, apply, upload documents, get a reference", keywords: "public apply licence citizen portal online application" },
  { key: "/verify", label: "Public portal: track or verify a licence", icon: "global", group: "Public pages", sidebar: false, external: true, description: "Anyone can check a licence number printed on a certificate", keywords: "public verify licence check" },
  { key: "/track", label: "Public portal: track a case", icon: "global", group: "Public pages", sidebar: false, external: true, description: "Reference lookup and rating for reporters", keywords: "public tracking reference" },
];

const RANK: Record<Role, number> = { MEMBER: 0, MANAGER: 1, ADMIN: 2, OWNER: 3 };

export function visibleNav(role: Role): NavItem[] {
  return NAV.filter((n) => !n.minRole || RANK[role] >= RANK[n.minRole]);
}

export function sidebarGroups(role: Role): { label: NavGroup; items: NavItem[] }[] {
  const items = visibleNav(role).filter((n) => n.sidebar !== false);
  return NAV_GROUP_ORDER.map((label) => ({ label, items: items.filter((n) => n.group === label) })).filter((g) => g.items.length > 0);
}

/** Which registry item a pathname belongs to (longest match wins). */
export function activeNavKey(pathname: string, role: Role): string {
  const candidates = visibleNav(role).filter((n) => n.sidebar !== false).map((n) => ({ key: n.key, re: new RegExp(`^${n.match || n.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).filter((n) => n.re.test(pathname));
  candidates.sort((a, b) => b.key.length - a.key.length);
  return candidates[0]?.key || "/app";
}

/** Simple ranked text match over label, description and keywords. */
export function searchNav(role: Role, query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  const items = visibleNav(role);
  if (!q) return items;
  const words = q.split(/\s+/);
  return items
    .map((n) => {
      const hay = `${n.label} ${n.description || ""} ${n.keywords || ""} ${n.group}`.toLowerCase();
      const label = n.label.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (label.startsWith(w)) score += 5;
        else if (label.includes(w)) score += 3;
        else if (hay.includes(w)) score += 1;
        else return null;
      }
      return { n, score };
    })
    .filter((x): x is { n: NavItem; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.n);
}
