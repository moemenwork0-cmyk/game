/** Small helpers for the candy-style markup. */

/** Text with a thick outline (the ::before copy draws the outline). */
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

/** 3D candy button. */
export function button(cls: string, label: string, icon = '', extra = ''): string {
  return `<button class="btn3d ${cls}" type="button">${extra}<span class="btn-label">${icon}${label ? `<span>${label}</span>` : ''}</span></button>`;
}
