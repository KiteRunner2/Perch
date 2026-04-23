import { create } from 'zustand';
import { storage, type Scope, type Theme } from './lib/storage';

interface UIState {
  token: string | null;
  theme: Theme;
  scope: Scope;
  orgs: string[];
  selectedPRId: string | null;
  detailOpen: boolean;
  settingsOpen: boolean;
  helpOpen: boolean;
  searchQuery: string;
  collapsedBuckets: Set<string>;
  setToken: (token: string | null) => void;
  setTheme: (theme: Theme) => void;
  setScope: (scope: Scope) => void;
  setOrgs: (orgs: string[]) => void;
  setSelectedPRId: (id: string | null) => void;
  setDetailOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  toggleBucket: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  token: storage.getToken(),
  theme: storage.getTheme(),
  scope: storage.getScope(),
  orgs: storage.getOrgs(),
  selectedPRId: null,
  detailOpen: false,
  settingsOpen: false,
  helpOpen: false,
  searchQuery: '',
  collapsedBuckets: new Set<string>(),
  setToken: (token) => {
    if (token) storage.setToken(token);
    else storage.clearToken();
    set({ token });
  },
  setTheme: (theme) => {
    storage.setTheme(theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  setScope: (scope) => {
    storage.setScope(scope);
    set({ scope });
  },
  setOrgs: (orgs) => {
    storage.setOrgs(orgs);
    set({ orgs });
  },
  setSelectedPRId: (id) => set({ selectedPRId: id }),
  setDetailOpen: (open) => set({ detailOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleBucket: (id) =>
    set((s) => {
      const next = new Set(s.collapsedBuckets);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedBuckets: next };
    }),
}));

// Initialize the theme on import
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = storage.getTheme();
}
