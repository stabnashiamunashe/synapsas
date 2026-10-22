// Tiny, safe arithmetic evaluator for computed table columns.
// Supports: column keys, numbers, + - * / ( ), unary minus. No function calls, no globals.

import type { Condition, FieldDef, TableColumnDef } from "./types";

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: "num", v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/()".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${c}" in formula`);
  }
  return out;
}

export function evaluateFormula(formula: string, scope: Record<string, unknown>): number {
  const toks = tokenize(formula);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
    return Number.isFinite(n) ? n : 0;
  };

  function primary(): number {
    const t = next();
    if (!t) throw new Error("Unexpected end of formula");
    if (t.t === "num") return t.v;
    if (t.t === "id") return num(scope[t.v]);
    if (t.t === "op" && t.v === "(") {
      const v = expr();
      const close = next();
      if (!close || close.t !== "op" || close.v !== ")") throw new Error("Expected )");
      return v;
    }
    if (t.t === "op" && t.v === "-") return -primary();
    throw new Error(`Unexpected token ${t.v}`);
  }
  function term(): number {
    let v = primary();
    while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = (next() as { v: string }).v;
      const r = primary();
      v = op === "*" ? v * r : r === 0 ? 0 : v / r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = (next() as { v: string }).v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const result = expr();
  if (pos !== toks.length) throw new Error("Unexpected trailing tokens");
  return result;
}

/** Recompute computed columns for every row of a table field. */
export function computeRows(
  columns: TableColumnDef[],
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return (rows || []).map((row) => {
    const out = { ...row };
    for (const col of columns) {
      if (col.type === "computed" && col.formula) {
        try {
          out[col.key] = Math.round(evaluateFormula(col.formula, out) * 100) / 100;
        } catch {
          out[col.key] = 0;
        }
      }
    }
    return out;
  });
}

export function columnSum(rows: Record<string, unknown>[], key: string) {
  return (rows || []).reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

/** Normalise submitted form data: compute table rows and totals. */
export function normaliseFormData(
  fields: FieldDef[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const f of fields) {
    if (f.type === "table" && f.columns) {
      const rows = computeRows(f.columns, (out[f.key] as Record<string, unknown>[]) || []);
      out[f.key] = rows;
      if (f.totalColumn) out[`${f.key}Total`] = columnSum(rows, f.totalColumn);
    }
  }
  return out;
}

/** Evaluate a level/field condition against form data. Missing condition => true. */
export function evaluateCondition(
  cond: Condition | undefined | null,
  data: Record<string, unknown>,
): boolean {
  if (!cond || !cond.field) return true;
  const v = data[cond.field];
  const target = cond.value;
  const n = (x: unknown) => (typeof x === "number" ? x : parseFloat(String(x ?? "")));
  switch (cond.op) {
    case "eq":
      return String(v ?? "") === String(target ?? "");
    case "neq":
      return String(v ?? "") !== String(target ?? "");
    case "gt":
      return n(v) > n(target);
    case "gte":
      return n(v) >= n(target);
    case "lt":
      return n(v) < n(target);
    case "lte":
      return n(v) <= n(target);
    case "in": {
      const arr = Array.isArray(target)
        ? target.map(String)
        : String(target ?? "").split(",").map((s) => s.trim());
      return arr.includes(String(v ?? ""));
    }
    case "contains":
      if (Array.isArray(v)) return v.map(String).includes(String(target));
      return String(v ?? "").toLowerCase().includes(String(target ?? "").toLowerCase());
    case "empty":
      return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    case "notEmpty":
      return !(v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
    default:
      return true;
  }
}

/** Render "{{field}}" placeholders inside a title template. */
export function renderTemplate(tpl: string, data: Record<string, unknown>) {
  return tpl.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = data[k];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.length + " items";
    return String(v);
  });
}
