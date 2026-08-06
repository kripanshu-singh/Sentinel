export function formatValue(value: unknown, maxLength = 240): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return truncate(value, maxLength);
  try {
    return truncate(JSON.stringify(value), maxLength);
  } catch {
    return String(value);
  }
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function log(scope: string, message: string, data?: unknown): void {
  const ts = new Date().toISOString();
  const suffix = data === undefined ? "" : ` ${formatValue(data)}`;
  console.log(`[${ts}] [${scope}] ${message}${suffix}`);
}
