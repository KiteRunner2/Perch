const TOKEN_KEY = 'perch.token';
const THEME_KEY = 'perch.theme';
const SCOPE_KEY = 'perch.scope';
const ORGS_KEY = 'perch.orgs';

export type Theme = 'dark' | 'light';
export type Scope = 'inbox' | 'all';

export const storage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
  getTheme(): Theme {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' ? 'light' : 'dark';
  },
  setTheme(theme: Theme): void {
    localStorage.setItem(THEME_KEY, theme);
  },
  getScope(): Scope {
    return localStorage.getItem(SCOPE_KEY) === 'all' ? 'all' : 'inbox';
  },
  setScope(scope: Scope): void {
    localStorage.setItem(SCOPE_KEY, scope);
  },
  getOrgs(): string[] {
    const raw = localStorage.getItem(ORGS_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === 'string');
      }
    } catch {
      /* ignore malformed */
    }
    return [];
  },
  setOrgs(orgs: string[]): void {
    localStorage.setItem(ORGS_KEY, JSON.stringify(orgs));
  },
};

/** Redact a token for logging/error display. */
export function redactToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
