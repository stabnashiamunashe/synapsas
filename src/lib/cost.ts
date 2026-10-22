// Cost extraction: every request can carry a monetary amount so projects can aggregate spend.
import type { FieldDef, TemplateSettings } from "./types";

/** Candidate cost sources on a template: table totals first, then currency fields. */
export function costFieldOptions(fields: FieldDef[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const f of fields) {
    if (f.type === "table" && f.totalColumn) out.push({ value: `${f.key}Total`, label: `${f.label} total` });
  }
  for (const f of fields) {
    if (f.type === "currency" || f.type === "number") out.push({ value: f.key, label: f.label });
  }
  return out;
}

/** Resolve which data key holds the request cost: explicit setting, else first sensible candidate. */
export function resolveCostKey(fields: FieldDef[], settings: TemplateSettings): string | null {
  if (settings.costField === "none") return null;
  if (settings.costField) return settings.costField;
  const opts = costFieldOptions(fields);
  // Auto-detect only table totals or currency fields (plain numbers could be quantities).
  const auto = opts.find((o) => o.value.endsWith("Total")) || fields.filter((f) => f.type === "currency").map((f) => ({ value: f.key }))[0];
  return auto?.value ?? null;
}

/** Numeric cost from normalised form data, or null when the template has no cost source. */
export function extractCost(fields: FieldDef[], settings: TemplateSettings, data: Record<string, unknown>): number | null {
  const key = resolveCostKey(fields, settings);
  if (!key) return null;
  const v = data[key];
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
