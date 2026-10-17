/** Small helpers for the candy-style markup. */

/** Text with a soft outline (the ::before copy draws it), used for big numbers and the logo. */
export function stroked(text: string, cls = ''): string {
  const t = escapeHtml(text);
  return `<span class="stroked ${cls}" data-t="${t}">${t}</span>`;
}

/** Updates a stroked span's text and its outline copy. */
export function setStroked(el: HTMLElement, text: string): void {
  if (el.textContent === text) return;
  el.textContent = text;
  el.dataset.t = text;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Game button: `btn-primary` (green), `btn-gold`, `btn-glass`; add `btn-lg` / `btn-icon` for size. */
export function button(cls: string, label: string, icon = ''): string {
  return `<button class="btn ${cls}" type="button"><span class="btn-face">${icon}${label ? `<span class="btn-text">${label}</span>` : ''}</span></button>`;
}

/**
 * Scales every dialog panel down (CSS zoom) so it fits short screens such as a 900×500 iframe.
 * Panels stay in the DOM while hidden, so this can run at any time (on resize and when shown).
 */
export function fitPanels(root: HTMLElement): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  root.querySelectorAll<HTMLElement>('.overlay .panel').forEach((p) => {
    p.style.removeProperty('zoom');
    const h = p.offsetHeight;
    const w = p.offsetWidth;
    if (!h || !w) return;
    // Room for the title ribbon (and the results' record burst) above the panel, and the shadow below.
    const above = p.querySelector('.best-burst') ? 72 : 40;
    const z = Math.min(1, (vh - above - 20) / (h + 10), (vw - 16) / w);
    if (z < 0.999) p.style.setProperty('zoom', z.toFixed(3));
  });
}
