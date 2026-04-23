import { useEffect } from 'react';
import type { Bucket, DashboardPR } from '../types/dashboard';
import { useUIStore } from '../store';

interface Options {
  buckets: Bucket[];
  onRefresh: () => void;
}

/**
 * Global keyboard navigation:
 * - j / k: move selection down / up across flattened PR list
 * - enter: open selected PR in a new tab
 * - e: open detail drawer for selected PR
 * - /: focus search
 * - ?: toggle shortcut help
 * - escape: close drawer / help
 * - r: manual refresh
 */
export function useKeyboardNav({ buckets, onRefresh }: Options): void {
  const selectedPRId = useUIStore((s) => s.selectedPRId);
  const setSelectedPRId = useUIStore((s) => s.setSelectedPRId);
  const setDetailOpen = useUIStore((s) => s.setDetailOpen);
  const detailOpen = useUIStore((s) => s.detailOpen);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const setHelpOpen = useUIStore((s) => s.setHelpOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const collapsedBuckets = useUIStore((s) => s.collapsedBuckets);

  useEffect(() => {
    const flatList: DashboardPR[] = buckets
      .filter((b) => !collapsedBuckets.has(b.id))
      .flatMap((b) => b.items);

    // Initialize selection when possible
    if (!selectedPRId && flatList.length > 0) {
      setSelectedPRId(flatList[0]!.id);
    }

    function currentIndex(): number {
      return flatList.findIndex((p) => p.id === selectedPRId);
    }

    function isEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Always-on: escape
      if (e.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false);
          e.preventDefault();
          return;
        }
        if (detailOpen) {
          setDetailOpen(false);
          e.preventDefault();
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          e.preventDefault();
          return;
        }
      }

      if (isEditable(e.target)) {
        return;
      }

      switch (e.key) {
        case '?': {
          setHelpOpen(!helpOpen);
          e.preventDefault();
          break;
        }
        case '/': {
          const search = document.querySelector<HTMLInputElement>('input[data-search]');
          if (search) {
            search.focus();
            e.preventDefault();
          }
          break;
        }
        case 'j': {
          if (flatList.length === 0) return;
          const i = currentIndex();
          const next = Math.min(flatList.length - 1, i < 0 ? 0 : i + 1);
          setSelectedPRId(flatList[next]!.id);
          e.preventDefault();
          break;
        }
        case 'k': {
          if (flatList.length === 0) return;
          const i = currentIndex();
          const prev = Math.max(0, i < 0 ? 0 : i - 1);
          setSelectedPRId(flatList[prev]!.id);
          e.preventDefault();
          break;
        }
        case 'Enter': {
          const idx = currentIndex();
          if (idx >= 0) {
            window.open(flatList[idx]!.url, '_blank', 'noopener,noreferrer');
            e.preventDefault();
          }
          break;
        }
        case 'e': {
          if (selectedPRId) {
            setDetailOpen(!detailOpen);
            e.preventDefault();
          }
          break;
        }
        case 'r': {
          onRefresh();
          e.preventDefault();
          break;
        }
        case ',': {
          setSettingsOpen(!settingsOpen);
          e.preventDefault();
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    buckets,
    collapsedBuckets,
    selectedPRId,
    setSelectedPRId,
    detailOpen,
    setDetailOpen,
    helpOpen,
    setHelpOpen,
    settingsOpen,
    setSettingsOpen,
    onRefresh,
  ]);
}
