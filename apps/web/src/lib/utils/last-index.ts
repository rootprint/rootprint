const KEY = 'logwiz:last-index';

export function readLastIndex(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeLastIndex(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // localStorage unavailable (private mode, disabled, sandboxed iframe) — no-op
  }
}

export function clearLastIndex(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
