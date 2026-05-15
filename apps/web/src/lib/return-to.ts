export function signInPathWithReturnTo(currentPath: string): string {
  if (!currentPath || currentPath === "/") return "/auth/sign-in";
  return `/auth/sign-in?returnTo=${encodeURIComponent(currentPath)}`;
}

// Reject anything that isn't a single-slash relative path so an attacker
// can't smuggle in a protocol-relative URL like `//evil.com`.
export function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
