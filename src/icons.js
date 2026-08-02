// The icon always comes from the custom-icon field. This is what it starts out
// holding — kept as a single path so the source shown in the UI and the
// definition the renderer uses can never drift apart.
const DEFAULT_PATH =
  'M34.53,19.56h-9.08c.02,3.45,0,6.89-.07,10.34-.3,1.05-.98,1.72-2.03,2.03-3.26.07-6.52.09-9.78.07v8.94c3.49.02,6.99,0,10.48-.07.52-.08,1.03-.17,1.54-.28,4.71-1.26,7.62-4.27,8.74-9.01.2-4,.27-8.01.21-12.02M20.97,8.94c-3.26-.02-6.52,0-9.78.07-1.05.3-1.72.98-2.03,2.03-.07,3.45-.09,6.89-.07,10.34H0C-.01,17.65,0,13.93.08,10.2,1.2,4.31,4.71.91,10.63,0h10.34v8.94Z';

const DEFAULT_VIEW_BOX = [0, 0, 34.55, 40.95];

/** Source text the custom-icon field is prefilled with. */
export const DEFAULT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${DEFAULT_VIEW_BOX.join(
  ' ',
)}"><path d="${DEFAULT_PATH}"/></svg>`;

/**
 * Pre-parsed form of the same icon, used whenever the field is empty or holds
 * something unusable. Parsing is deliberately not done here: this module is
 * imported by the (DOM-free) generator.
 */
export const DEFAULT_ICON = {
  id: 'default',
  name: 'default',
  markup: `<path d="${DEFAULT_PATH}"/>`,
  viewBox: DEFAULT_VIEW_BOX,
  inheritsColor: true,
};

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
