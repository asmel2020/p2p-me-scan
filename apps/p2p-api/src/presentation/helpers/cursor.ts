export function encodeCursor(payload: Record<string, string | number>): string {
  return btoa(JSON.stringify(payload));
}

export function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(cursor));
  } catch {
    return null;
  }
}
