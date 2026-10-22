export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Convert a Prisma row with JSON-text columns into an API-friendly object. */
export function hydrate<T extends Record<string, unknown>>(
  row: T,
  jsonKeys: (keyof T)[],
): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of jsonKeys) {
    const v = row[k];
    if (typeof v === "string") out[k as string] = parseJson(v, null);
  }
  return out as T;
}
