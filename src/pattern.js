import { getIcon } from './icons.js';

export const DEFAULTS = {
  words: ['love', 'peace', 'joy', 'stay wild'],
  iconId: 'chevrons',
  customIcon: '',
  customStroke: false,
  mode: 'grid', // 'grid' = strict lattice, 'flow' = packed rows
  width: 1200,
  height: 800,
  gapX: 24,
  gapY: 24,
  rotation: 0,
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: 34,
  fontWeight: '400',
  letterSpacing: 0,
  lineHeight: 1.05,
  uppercase: false,
  iconSize: 22,
  strokeWidth: 2,
  iconRotate: 0,
  bgColor: '#faf7f0',
  textColor: '#1b1b1b',
  iconColor: '#c8452f',
  transparent: false,
};

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]);
const num = (value) => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export function parseWords(input) {
  return String(input || '')
    .split(/[,\n]/)
    .map((word) => word.trim())
    .filter(Boolean);
}

/** An entry made of several words stacks them, one per line. */
export function splitLines(entry) {
  return String(entry).split(/\s+/).filter(Boolean);
}

/**
 * The pattern is a checkerboard lattice: a cell holds a word when (col + row) is
 * even and an icon when it is odd, so every word ends up with an icon directly
 * above, below, left and right of it:
 *
 *        <>
 *   <>   w    <>
 *        <>
 *
 * Words are handed out in reading order and cycle through the list forever. An
 * entry holding several words ("stay wild") stacks them, one line per word,
 * centred inside its cell.
 *
 * @param {object} options  see DEFAULTS
 * @param {(word: string) => number} measure  text width in px for the current font
 */
export function buildPattern(options, measure) {
  const opt = { ...DEFAULTS, ...options };
  const entries = (opt.words.length ? opt.words : DEFAULTS.words).map((entry) =>
    splitLines(opt.uppercase ? String(entry).toUpperCase() : entry),
  );
  const icon = resolveIcon(opt);

  const ls = opt.letterSpacing;
  const widthOf = (word) => Math.max(1, measure(word) + ls * word.length);
  // A stacked entry is as wide as its widest line and as tall as its line count.
  const entryWidths = entries.map((lines) => Math.max(...lines.map(widthOf)));
  const maxEntryWidth = Math.max(...entryWidths);
  const maxLines = Math.max(...entries.map((lines) => lines.length));
  const lineStep = opt.fontSize * opt.lineHeight;
  const blockHeight = (maxLines - 1) * lineStep + opt.fontSize;

  // Half a step is the cell-centre → icon-centre distance.
  const halfStepY = blockHeight / 2 + opt.gapY + opt.iconSize / 2;
  const halfStepX = maxEntryWidth / 2 + opt.gapX + opt.iconSize / 2;

  const cx = opt.width / 2;
  const cy = opt.height / 2;
  // The lattice is built upright and then rotated, so it has to cover the canvas
  // rotated the other way: map the canvas corners back into lattice space and use
  // that (larger) box. Half an entry is added so cells straddling an edge exist.
  const theta = (opt.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));
  const reachX = cx * cos + cy * sin + maxEntryWidth / 2;
  const reachY = cx * sin + cy * cos + blockHeight / 2;

  const texts = [];
  const uses = [];
  let cursor = 0;
  const nextEntry = () => {
    const index = cursor++ % entries.length;
    return { lines: entries[index], width: entryWidths[index] };
  };

  const placeWord = (x, y, lines) => {
    // SVG letter-spacing is also applied after the final glyph; shift back to re-centre.
    const anchorX = num(x - ls / 2);
    // Baseline of the first line, so the whole stack ends up centred on y.
    const firstBaseline = y - ((lines.length - 1) * lineStep) / 2 + opt.fontSize * 0.34;
    const body =
      lines.length === 1
        ? esc(lines[0])
        : lines
            .map(
              (line, i) =>
                `<tspan x="${anchorX}" y="${num(firstBaseline + i * lineStep)}">${esc(line)}</tspan>`,
            )
            .join('');
    texts.push(`<text x="${anchorX}" y="${num(firstBaseline)}">${body}</text>`);
  };
  const placeIcon = (x, y) => {
    uses.push(`<use href="#pt-icon" xlink:href="#pt-icon" x="${num(x)}" y="${num(y)}"/>`);
  };

  const rowCount = Math.ceil(reachY / halfStepY) + 1;

  if (opt.mode === 'flow') {
    for (let row = -rowCount; row <= rowCount; row++) {
      const y = cy + row * halfStepY;
      // Offset every other row so words never stack into vertical columns.
      let x = cx - reachX - (row % 2 ? halfStepX : 0);
      let wantsWord = (row & 1) === 0;
      const limit = cx + reachX;
      while (x < limit) {
        if (wantsWord) {
          const entry = nextEntry();
          x += entry.width / 2;
          placeWord(x, y, entry.lines);
          x += entry.width / 2 + opt.gapX;
        } else {
          x += opt.iconSize / 2;
          placeIcon(x, y);
          x += opt.iconSize / 2 + opt.gapX;
        }
        wantsWord = !wantsWord;
      }
    }
  } else {
    const colCount = Math.ceil(reachX / halfStepX) + 1;
    for (let row = -rowCount; row <= rowCount; row++) {
      const y = cy + row * halfStepY;
      for (let col = -colCount; col <= colCount; col++) {
        const x = cx + col * halfStepX;
        if (((col + row) & 1) === 0) placeWord(x, y, nextEntry().lines);
        else placeIcon(x, y);
      }
    }
  }

  const svg = assemble({ opt, icon, texts, uses });
  return { svg, wordCount: texts.length, iconCount: uses.length };
}

function resolveIcon(opt) {
  const icon = opt.customIcon ? opt.customIcon : getIcon(opt.iconId);
  return { viewBox: [0, 0, 24, 24], ...icon };
}

function assemble({ opt, icon, texts, uses }) {
  const [minX, minY, boxW, boxH] = icon.viewBox;
  const scale = opt.iconSize / Math.max(boxW, boxH);
  const iconTransform = [
    `rotate(${num(opt.iconRotate)})`,
    `scale(${num(scale)})`,
    `translate(${num(-(minX + boxW / 2))} ${num(-(minY + boxH / 2))})`,
  ].join(' ');

  let iconBody;
  if (icon.markup) {
    iconBody = icon.markup;
  } else if (icon.stroke) {
    iconBody =
      `<path d="${icon.d}" fill="none" stroke-width="${num(opt.strokeWidth / scale)}" ` +
      `stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    iconBody = `<path d="${icon.d}"/>`;
  }

  const iconFill = icon.markup && !icon.inheritsColor ? '' : ` fill="${esc(opt.iconColor)}"`;
  const iconStroke = icon.stroke ? ` stroke="${esc(opt.iconColor)}"` : '';

  const rotate = opt.rotation
    ? ` transform="rotate(${num(opt.rotation)} ${num(opt.width / 2)} ${num(opt.height / 2)})"`
    : '';

  const background = opt.transparent
    ? ''
    : `\n  <rect width="${num(opt.width)}" height="${num(opt.height)}" fill="${esc(opt.bgColor)}"/>`;

  const textAttrs = [
    `font-family="${esc(opt.fontFamily)}"`,
    `font-size="${num(opt.fontSize)}"`,
    `font-weight="${esc(opt.fontWeight)}"`,
    `fill="${esc(opt.textColor)}"`,
    'text-anchor="middle"',
    opt.letterSpacing ? `letter-spacing="${num(opt.letterSpacing)}"` : '',
    'xml:space="preserve"',
  ]
    .filter(Boolean)
    .join(' ');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${num(
    opt.width,
  )}" height="${num(opt.height)}" viewBox="0 0 ${num(opt.width)} ${num(opt.height)}">
  <defs>
    <clipPath id="pt-clip"><rect width="${num(opt.width)}" height="${num(opt.height)}"/></clipPath>
    <g id="pt-icon"${iconFill}${iconStroke} transform="${iconTransform}">${iconBody}</g>
  </defs>${background}
  <g clip-path="url(#pt-clip)">
    <g${rotate}>
      <g ${textAttrs}>
        ${texts.join('\n        ')}
      </g>
      <g>
        ${uses.join('\n        ')}
      </g>
    </g>
  </g>
</svg>
`;
}
