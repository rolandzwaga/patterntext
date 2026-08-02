import { ICONS, parseCustomIcon } from './icons.js';
import { DEFAULTS, buildPattern, parseWords } from './pattern.js';

const STORAGE_KEY = 'patterntext:settings';
const $ = (id) => document.getElementById(id);

const fields = {
  words: $('words'),
  customIcon: $('customIcon'),
  customStroke: $('customStroke'),
  width: $('width'),
  height: $('height'),
  gapX: $('gapX'),
  gapY: $('gapY'),
  rotation: $('rotation'),
  fontFamily: $('fontFamily'),
  fontSize: $('fontSize'),
  fontWeight: $('fontWeight'),
  letterSpacing: $('letterSpacing'),
  lineHeight: $('lineHeight'),
  uppercase: $('uppercase'),
  iconSize: $('iconSize'),
  strokeWidth: $('strokeWidth'),
  iconRotate: $('iconRotate'),
  bgColor: $('bgColor'),
  textColor: $('textColor'),
  iconColor: $('iconColor'),
  transparent: $('transparent'),
};

const preview = $('preview');
const status = $('status');
let selectedIcon = DEFAULTS.iconId;
let currentSvg = '';

/* ---------- text measurement ---------- */

const measureCtx = document.createElement('canvas').getContext('2d');
function makeMeasurer({ fontWeight, fontSize, fontFamily }) {
  measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const cache = new Map();
  return (word) => {
    let width = cache.get(word);
    if (width === undefined) {
      width = measureCtx.measureText(word).width;
      cache.set(word, width);
    }
    return width;
  };
}

/* ---------- icon picker ---------- */

function buildIconGrid() {
  const grid = $('iconGrid');
  grid.innerHTML = ICONS.map((icon) => {
    const body = icon.stroke
      ? `<path d="${icon.d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="${icon.d}" fill="currentColor"/>`;
    return `<button type="button" class="icon-btn" data-icon="${icon.id}" title="${icon.name}" aria-label="${icon.name}">
      <svg viewBox="0 0 24 24" width="22" height="22">${body}</svg>
    </button>`;
  }).join('');
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('.icon-btn');
    if (!button) return;
    selectedIcon = button.dataset.icon;
    fields.customIcon.value = '';
    markSelectedIcon();
    render();
  });
}

function markSelectedIcon() {
  const usingCustom = Boolean(fields.customIcon.value.trim());
  document.querySelectorAll('.icon-btn').forEach((button) => {
    button.classList.toggle('is-active', !usingCustom && button.dataset.icon === selectedIcon);
  });
}

/* ---------- options <-> form ---------- */

function readOptions() {
  const numberOf = (el, fallback) => {
    const value = parseFloat(el.value);
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    words: parseWords(fields.words.value),
    iconId: selectedIcon,
    customIcon: fields.customIcon.value,
    customStroke: fields.customStroke.checked,
    mode: document.querySelector('input[name="mode"]:checked').value,
    width: Math.min(8000, Math.max(100, numberOf(fields.width, DEFAULTS.width))),
    height: Math.min(8000, Math.max(100, numberOf(fields.height, DEFAULTS.height))),
    gapX: numberOf(fields.gapX, DEFAULTS.gapX),
    gapY: numberOf(fields.gapY, DEFAULTS.gapY),
    rotation: numberOf(fields.rotation, 0),
    fontFamily: fields.fontFamily.value,
    fontSize: numberOf(fields.fontSize, DEFAULTS.fontSize),
    fontWeight: fields.fontWeight.value,
    letterSpacing: numberOf(fields.letterSpacing, 0),
    lineHeight: numberOf(fields.lineHeight, DEFAULTS.lineHeight),
    uppercase: fields.uppercase.checked,
    iconSize: numberOf(fields.iconSize, DEFAULTS.iconSize),
    strokeWidth: numberOf(fields.strokeWidth, DEFAULTS.strokeWidth),
    iconRotate: numberOf(fields.iconRotate, 0),
    bgColor: fields.bgColor.value,
    textColor: fields.textColor.value,
    iconColor: fields.iconColor.value,
    transparent: fields.transparent.checked,
  };
}

function applyOptions(opt) {
  fields.words.value = Array.isArray(opt.words) ? opt.words.join(', ') : opt.words ?? '';
  fields.customIcon.value = opt.customIcon ?? '';
  fields.customStroke.checked = Boolean(opt.customStroke);
  const modeInput = document.querySelector(`input[name="mode"][value="${opt.mode}"]`);
  if (modeInput) modeInput.checked = true;
  for (const key of [
    'width', 'height', 'gapX', 'gapY', 'rotation', 'fontFamily', 'fontSize',
    'fontWeight', 'letterSpacing', 'lineHeight', 'iconSize', 'strokeWidth', 'iconRotate',
    'bgColor', 'textColor', 'iconColor',
  ]) {
    if (opt[key] !== undefined) fields[key].value = opt[key];
  }
  fields.uppercase.checked = Boolean(opt.uppercase);
  fields.transparent.checked = Boolean(opt.transparent);
  selectedIcon = opt.iconId || DEFAULTS.iconId;
}

/* ---------- render ---------- */

function render() {
  const opt = readOptions();
  syncOutputs();
  markSelectedIcon();

  const raw = opt.customIcon.trim();
  let custom = null;
  if (raw) {
    custom = parseCustomIcon(raw, { stroke: opt.customStroke });
    if (!custom) {
      status.textContent = 'Custom icon: not valid path data or SVG — using the selected icon.';
    }
  }

  const result = buildPattern({ ...opt, customIcon: custom }, makeMeasurer(opt));

  currentSvg = result.svg;
  preview.innerHTML = result.svg;
  const svgEl = preview.querySelector('svg');
  if (svgEl) {
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.style.aspectRatio = `${opt.width} / ${opt.height}`;
  }
  if (!raw || custom) {
    status.textContent = `${result.wordCount} word cells · ${result.iconCount} icons · ${opt.width}×${opt.height}`;
  }
  save(opt);
}

function syncOutputs() {
  document.querySelectorAll('output[for]').forEach((out) => {
    const input = $(out.getAttribute('for'));
    if (!input) return;
    const suffix = input.id === 'rotation' || input.id === 'iconRotate' ? '°' : '';
    out.textContent = input.value + suffix;
  });
}

const debounce = (fn, ms = 90) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};
const renderSoon = debounce(render);

/* ---------- persistence ---------- */

function save(opt) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opt));
  } catch {
    /* storage disabled — settings just won't persist */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) applyOptions(JSON.parse(raw));
  } catch {
    /* ignore malformed saved state */
  }
}

/* ---------- export ---------- */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baseName() {
  const first = parseWords(fields.words.value)[0] || 'pattern';
  return `patterntext-${first.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
}

function exportPng() {
  const opt = readOptions();
  const scale = 2;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' }));
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = opt.width * scale;
    canvas.height = opt.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, opt.width, opt.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `${baseName()}@2x.png`), 'image/png');
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    status.textContent = 'PNG export failed — download the SVG instead.';
  };
  image.src = url;
}

/* ---------- wiring ---------- */

buildIconGrid();
load();

for (const element of Object.values(fields)) {
  const event = element.type === 'checkbox' || element.tagName === 'SELECT' ? 'change' : 'input';
  element.addEventListener(event, renderSoon);
}
document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener('change', render));

$('downloadSvg').addEventListener('click', () => {
  downloadBlob(new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' }), `${baseName()}.svg`);
});
$('downloadPng').addEventListener('click', exportPng);
$('copySvg').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentSvg);
    status.textContent = 'SVG copied to clipboard.';
  } catch {
    status.textContent = 'Clipboard blocked — use Download SVG.';
  }
});
$('reset').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  applyOptions({ ...DEFAULTS, words: DEFAULTS.words, customIcon: '' });
  render();
});

render();
