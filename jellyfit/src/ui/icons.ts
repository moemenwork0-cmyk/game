/** Inline SVG icons (no external assets). Rounded, filled, 24×24. */
const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICON = {
  crown: svg('<path fill="currentColor" d="M3.2 8.2a1 1 0 0 1 1.6-.9l3.4 2.9 2.9-5a1 1 0 0 1 1.8 0l2.9 5 3.4-2.9a1 1 0 0 1 1.6.9l-1.5 9a1 1 0 0 1-1 .8H5.7a1 1 0 0 1-1-.8l-1.5-9zM5.5 19.6h13a1 1 0 0 1 0 2h-13a1 1 0 0 1 0-2z"/>'),
  gear: svg(
    '<path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.4 7.4 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6c0 .3.3.5.5.5h4c.3 0 .5-.2.5-.4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>',
  ),
  pause: svg('<rect x="6" y="5" width="4.4" height="14" rx="1.8" fill="currentColor"/><rect x="13.6" y="5" width="4.4" height="14" rx="1.8" fill="currentColor"/>'),
  play: svg('<path fill="currentColor" d="M8 5.6v12.8a1.3 1.3 0 0 0 2 1.1l10-6.4a1.3 1.3 0 0 0 0-2.2l-10-6.4a1.3 1.3 0 0 0-2 1.1z"/>'),
  home: svg('<path fill="currentColor" d="M11.3 3.5a1.1 1.1 0 0 1 1.4 0l8 6.6a1 1 0 0 1-.6 1.8H19V19a2 2 0 0 1-2 2h-2.5v-5.2a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V21H7a2 2 0 0 1-2-2v-7.1H3.9a1 1 0 0 1-.6-1.8l8-6.6z"/>'),
  replay: svg('<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M4.6 12a7.4 7.4 0 1 0 2.2-5.3"/><path fill="currentColor" d="M3.4 3.6a.9.9 0 0 1 1.5-.6l4.3 4a.9.9 0 0 1-.5 1.6l-5 .6a.9.9 0 0 1-1-1l.7-4.6z"/>'),
  close: svg('<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  sound: svg('<path fill="currentColor" d="M4 9.2h3.2L11.6 5a1 1 0 0 1 1.7.7v12.6a1 1 0 0 1-1.7.7l-4.4-4.2H4a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 1-1z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M16.3 9a4.2 4.2 0 0 1 0 6M18.9 6.4a8 8 0 0 1 0 11.2"/>'),
  music: svg('<path fill="currentColor" d="M19 3.6v11.3a3.2 3.2 0 1 1-2-3V7.7l-7 1.6v7.6a3.2 3.2 0 1 1-2-3V6.6a1 1 0 0 1 .8-1l9-2a1 1 0 0 1 1.2 1z"/>'),
  vibrate: svg('<rect x="7.5" y="3" width="9" height="18" rx="2.4" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 8.5v7M20 8.5v7M1.5 10.5v3M22.5 10.5v3"/>'),
  motion: svg('<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M3 8h9M3 12h6M3 16h9"/><circle cx="17" cy="12" r="4.2" fill="currentColor"/>'),
  jello: svg('<path fill="currentColor" d="M12 3.2c4.6 0 8 3.9 8 9.3 0 2.6-.9 4.6-2.2 5.6-.8.6-1.6.3-2.2-.3-.7.6-1.7.8-2.6.4-.6.5-1.4.6-2 .6s-1.4-.1-2-.6c-.9.4-1.9.2-2.6-.4-.6.6-1.4.9-2.2.3C3.9 17.1 4 15.1 4 12.5c0-5.4 3.4-9.3 8-9.3z"/><circle cx="9.3" cy="11.6" r="1.4" fill="#1d1648"/><circle cx="14.7" cy="11.6" r="1.4" fill="#1d1648"/><path fill="none" stroke="#1d1648" stroke-width="1.5" stroke-linecap="round" d="M10.4 14.4q1.6 1.4 3.2 0"/>'),
  globe: svg('<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M3.6 12h16.8M12 3.4c2.6 2.4 3.8 5.3 3.8 8.6s-1.2 6.2-3.8 8.6c-2.6-2.4-3.8-5.3-3.8-8.6s1.2-6.2 3.8-8.6z"/>'),
};
