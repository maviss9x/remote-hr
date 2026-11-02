export function parseJsonArray<T = string>(val: unknown): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function stringifyJsonArray(val: unknown): string {
  if (!val) return "[]";
  if (typeof val === "string") {
    try {
      JSON.parse(val);
      return val;
    } catch {
      return JSON.stringify([val]);
    }
  }
  return JSON.stringify(val);
}

export function parseJsonObject<T = any>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === "object" && val !== null) return val as T;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === "object" && parsed !== null ? (parsed as T) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function stringifyJsonObject(val: unknown): string {
  if (!val) return "{}";
  if (typeof val === "string") {
    try {
      JSON.parse(val);
      return val;
    } catch {
      return JSON.stringify(val);
    }
  }
  return JSON.stringify(val);
}
