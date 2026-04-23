const TOKEN_KEY = 'perch.token';
const THEME_KEY = 'perch.theme';

export type Theme = 'dark' | 'light';

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
};

/** Redact a token for logging/error display. */
export function redactToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
