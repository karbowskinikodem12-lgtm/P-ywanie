/* ==========================================================================
   Icon set — hand-tuned 24×24 strokes, drawn to sit visually with SF Symbols.
   Stored as path fragments so they inline without an HTTP request.
   ========================================================================== */

export const PATHS = {
  swim: '<circle cx="15.5" cy="5.6" r="2"/><path d="M3.6 12.2l3.5-2.6 3.7 1.9 3.1-2.8"/><path d="M2 17.4c2.4-2 4.1-2 6.5 0s4.1 2 6.5 0 4.1-2 6.4 0"/><path d="M2 21c2.4-2 4.1-2 6.5 0s4.1 2 6.5 0 4.1-2 6.4 0"/>',
  gym: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  run: '<circle cx="15.5" cy="4.5" r="1.9"/><path d="M13.6 8.2L9.8 10l-2 4.4"/><path d="M13.6 8.2l3.2 2.6.8 4.2 2.4 3"/><path d="M11.4 12.6L8 15.4 4.5 16"/><path d="M13 15.6l-.6 5.2"/>',
  bike: '<circle cx="5.6" cy="17" r="3.4"/><circle cx="18.4" cy="17" r="3.4"/><path d="M8.4 17l3.4-6.4 3 6.4M11.8 10.6L9.6 7.4h3.8M15 7.4l3.4 9.6"/>',
  walk: '<circle cx="13.6" cy="4.4" r="1.9"/><path d="M12 8l-2.6 2.4.6 3.6 2.6 1.6"/><path d="M12.6 15.6L11 21M14 12.6l2.4 2.4.8 4"/><path d="M9.4 10.4L7 12.4"/>',
  mobility: '<circle cx="12" cy="4.6" r="1.9"/><path d="M12 8v5M8 21l4-8 4 8M7.5 11.5h9"/>',
  custom: '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12l1-8Z"/>',

  camera: '<path d="M4 8.6h2.4l1.4-2.2h8.4l1.4 2.2H20a1.6 1.6 0 0 1 1.6 1.6v7.4A1.6 1.6 0 0 1 20 19.4H4a1.6 1.6 0 0 1-1.6-1.6v-7.4A1.6 1.6 0 0 1 4 8.6Z"/><circle cx="12" cy="13.6" r="3.4"/>',
  image: '<rect x="3.2" y="5.2" width="17.6" height="13.6" rx="4"/><circle cx="9" cy="10" r="1.6"/><path d="M4 16.4l4.2-3.4 3.4 2.6 3-2.4 5.4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  drop: '<path d="M12 3.2c3.2 4 6 6.9 6 10a6 6 0 0 1-12 0c0-3.1 2.8-6 6-10Z"/>',
  flame: '<path d="M12 3c1.8 2.6 5.4 4.4 5.4 8.8A5.4 5.4 0 0 1 12 21a5.4 5.4 0 0 1-5.4-9.2C7.8 9.4 9 8.8 9.6 7c.8 1.2 1.6 1.8 2.4 2.2C11.4 7 11.2 5 12 3Z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c1.6-4 4.2-5.6 7.2-5.6S17.6 16 19.2 20"/>',
  home: '<path d="M4 10.6L12 4l8 6.6"/><path d="M6 10v9.4h12V10"/>',
  bulb: '<path d="M12 3.5c-3.6 0-6.5 2.7-6.5 6 0 2 1 3.4 2.2 4.6.7.7 1.1 1.4 1.1 2.3v.6h6.4v-.6c0-.9.4-1.6 1.1-2.3 1.2-1.2 2.2-2.6 2.2-4.6 0-3.3-2.9-6-6.5-6Z"/><path d="M10 20.5h4"/>',
  check: '<path d="M4.5 12.6l5 5L19.5 6.6"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.8"/><path d="M8.2 12.4l2.6 2.6 5-5.4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  xCircle: '<circle cx="12" cy="12" r="8.8"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>',
  chevronLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chevronRight: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  chevronDown: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M6.5 7l.9 11.4a1.6 1.6 0 0 0 1.6 1.4h6a1.6 1.6 0 0 0 1.6-1.4L17.5 7"/>',
  edit: '<path d="M4 20h4.2L19.4 8.8a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20Z"/><path d="M14.5 6.5l3 3"/>',
  search: '<circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8L20.5 20.5"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  bell: '<path d="M18 8.6a6 6 0 1 0-12 0c0 6-2.4 7.6-2.4 7.6h16.8S18 14.6 18 8.6Z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
  moon: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4Z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.2M12 19.4v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.4 12h2.2M19.4 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
  sparkles: '<path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6L12 3.5Z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
  download: '<path d="M12 3.5v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 17v2.5h15V17"/>',
  upload: '<path d="M12 20.5v-11M7.5 13.5L12 9l4.5 4.5"/><path d="M4.5 5V2.5h15V5"/>',
  info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.4M12 7.8v.2"/>',
  warn: '<path d="M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4.4M12 16.8v.2"/>',
  refresh: '<path d="M20.4 11.6a8.4 8.4 0 1 1-2.4-5.6"/><path d="M20.6 3.6v5h-5"/>',
  scale: '<path d="M12 4.5v15"/><circle cx="12" cy="4" r="1.6"/><path d="M4.5 20h15"/><path d="M6 10h12l2.4 6H3.6L6 10Z"/>',
  moonZ: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4Z"/><path d="M14.5 4h4l-4 4h4"/>',
  calendar: '<rect x="3.4" y="5.4" width="17.2" height="15.2" rx="3.2"/><path d="M3.4 10h17.2M8.4 3.4v3.6M15.6 3.4v3.6"/>',
  filter: '<path d="M3.6 5.6h16.8L14 13v6l-4-2.2V13L3.6 5.6Z"/>',
  undo: '<path d="M4 9.4h10.6a5.4 5.4 0 0 1 0 10.8H8"/><path d="M8 5l-4 4.4 4 4.2"/>',
  target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1"/>',
  cpu: '<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.4"/><path d="M9.6 3.4v3M14.4 3.4v3M9.6 17.6v3M14.4 17.6v3M3.4 9.6h3M3.4 14.4h3M17.6 9.6h3M17.6 14.4h3"/>',
  share: '<path d="M12 3.5v12"/><path d="M8 7l4-3.5L16 7"/><path d="M5 13v6.5h14V13"/>',
  lock: '<rect x="4.8" y="10.4" width="14.4" height="10.2" rx="3"/><path d="M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0v2.8"/>',
  book: '<path d="M4.5 4.5h6a3 3 0 0 1 3 3v13a2.4 2.4 0 0 0-2.4-2.4H4.5V4.5Z"/><path d="M19.5 4.5h-6a3 3 0 0 0-3 3v13a2.4 2.4 0 0 1 2.4-2.4h6.6V4.5Z"/>',
};

/** Inline SVG markup for an icon name. */
export function icon(name, { size = 24, cls = '', stroke = 1.8 } = {}) {
  const body = PATHS[name] || PATHS.info;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${cls}" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export const hasIcon = (name) => Object.prototype.hasOwnProperty.call(PATHS, name);
