// Built-in icons. Every icon is authored inside a 24x24 box, centred on (12, 12),
// so the renderer can scale one of them to any size with the same transform.
export const ICONS = [
  {
    id: 'chevrons',
    name: '<>',
    stroke: true,
    d: 'M10 5 L3 12 L10 19 M14 5 L21 12 L14 19',
  },
  {
    id: 'diamond',
    name: 'diamond',
    d: 'M12 1.5 L22.5 12 L12 22.5 L1.5 12 Z',
  },
  {
    id: 'sparkle',
    name: 'sparkle',
    d: 'M12 1 C13.2 8 16 10.8 23 12 C16 13.2 13.2 16 12 23 C10.8 16 8 13.2 1 12 C8 10.8 10.8 8 12 1 Z',
  },
  {
    id: 'star5',
    name: 'star',
    d: 'M12 1.5 L14.9 9.1 L23 9.5 L16.7 14.6 L18.8 22.5 L12 18 L5.2 22.5 L7.3 14.6 L1 9.5 L9.1 9.1 Z',
  },
  {
    id: 'dot',
    name: 'dot',
    d: 'M12 6 A6 6 0 1 1 11.99 6 Z',
  },
  {
    id: 'ring',
    name: 'ring',
    stroke: true,
    d: 'M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z',
  },
  {
    id: 'plus',
    name: 'plus',
    d: 'M10.6 2 H13.4 V10.6 H22 V13.4 H13.4 V22 H10.6 V13.4 H2 V10.6 H10.6 Z',
  },
  {
    id: 'cross',
    name: 'cross',
    stroke: true,
    d: 'M4 4 L20 20 M20 4 L4 20',
  },
  {
    id: 'asterisk',
    name: 'asterisk',
    stroke: true,
    d: 'M12 2 V22 M3.3 7 L20.7 17 M3.3 17 L20.7 7',
  },
  {
    id: 'triangle',
    name: 'triangle',
    d: 'M12 2.5 L21.5 20 L2.5 20 Z',
  },
  {
    id: 'square',
    name: 'square',
    d: 'M3 3 H21 V21 H3 Z',
  },
  {
    id: 'heart',
    name: 'heart',
    d: 'M12 21.4 C12 21.4 2.6 14.6 2.6 8.6 C2.6 5.3 5.2 3 8 3 C9.9 3 11.3 4 12 5.3 C12.7 4 14.1 3 16 3 C18.8 3 21.4 5.3 21.4 8.6 C21.4 14.6 12 21.4 12 21.4 Z',
  },
  {
    id: 'leaf',
    name: 'leaf',
    d: 'M3 21 C3 10.5 9.5 3 21 3 C21 13.5 14.5 21 3 21 Z',
  },
  {
    id: 'flower',
    name: 'flower',
    d: 'M12 2 A5 5 0 0 1 17 7 A5 5 0 0 1 22 12 A5 5 0 0 1 17 17 A5 5 0 0 1 12 22 A5 5 0 0 1 7 17 A5 5 0 0 1 2 12 A5 5 0 0 1 7 7 A5 5 0 0 1 12 2 Z',
  },
  {
    id: 'wave',
    name: 'wave',
    stroke: true,
    d: 'M2 14 C5 6 9 6 12 12 C15 18 19 18 22 10',
  },
  {
    id: 'eye',
    name: 'eye',
    stroke: true,
    d: 'M2 12 C6 5.5 18 5.5 22 12 C18 18.5 6 18.5 2 12 Z M12 9.5 A2.5 2.5 0 1 1 11.99 9.5 Z',
  },
];

export const DEFAULT_ICON = 'chevrons';

export function getIcon(id) {
  return ICONS.find((icon) => icon.id === id) || ICONS[0];
}

/**
 * Turn whatever the user pasted into a renderable icon definition.
 * Accepts either raw path data ("M12 2 L…") or a complete <svg> document.
 * Returns null when the input is empty or unusable.
 */
export function parseCustomIcon(source, { stroke = false } = {}) {
  const text = (source || '').trim();
  if (!text) return null;

  if (text.startsWith('<')) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) return null;

    // Anything that could execute or phone home is dropped before we inline it.
    svg.querySelectorAll('script, foreignObject, image, use').forEach((el) => el.remove());

    const viewBox = svg.getAttribute('viewBox');
    let box = [0, 0, 24, 24];
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) box = parts;
    } else {
      const w = parseFloat(svg.getAttribute('width'));
      const h = parseFloat(svg.getAttribute('height'));
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) box = [0, 0, w, h];
    }
    const markup = svg.innerHTML.trim();
    if (!markup) return null;
    return { id: 'custom', name: 'custom', markup, viewBox: box, inheritsColor: !/fill=|stroke=/.test(markup) };
  }

  if (!/^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\-\s]+$/.test(text)) return null;
  return { id: 'custom', name: 'custom', d: text, stroke, viewBox: [0, 0, 24, 24], inheritsColor: true };
}
