import { useEffect } from 'react';

const BASE_TITLE = 'Perch — Inbox';

/**
 * Keeps the browser tab title and favicon in sync with the
 * "Waiting on me" count.
 */
export function useTitleAndFavicon(waitingCount: number): void {
  useEffect(() => {
    document.title =
      waitingCount > 0 ? `(${waitingCount}) ${BASE_TITLE}` : BASE_TITLE;
  }, [waitingCount]);

  useEffect(() => {
    const url = makeFaviconDataUrl(waitingCount);
    if (!url) return;
    setFavicon(url);
  }, [waitingCount]);
}

function setFavicon(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = href;
}

/** Render the Perch favicon into a PNG data URL with an optional count badge. */
function makeFaviconDataUrl(count: number): string | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base: rounded square with the brand gradient.
  const radius = 12;
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#6aa9ff');
  grad.addColorStop(1, '#b48bff');
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, size, size, radius);
  ctx.fill();

  // ⌥ glyph — brand mark.
  ctx.fillStyle = '#0b0d10';
  ctx.font = 'bold 38px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⌥', size / 2, size / 2 + 2);

  // Count badge (top-right) when there's something to flag.
  if (count > 0) {
    const label = count > 99 ? '99+' : String(count);
    const badgeR = 15;
    const cx = size - badgeR - 1;
    const cy = badgeR + 1;

    // Subtle ring so the badge stays legible on both dark and light tabs.
    ctx.fillStyle = '#0b0d10';
    ctx.beginPath();
    ctx.arc(cx, cy, badgeR + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ec6a5e';
    ctx.beginPath();
    ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${label.length > 1 ? 16 : 20}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
  }

  return canvas.toDataURL('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
