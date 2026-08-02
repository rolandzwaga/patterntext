import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ICON, DEFAULT_ICON_SVG } from '../src/icons.js';
import { buildPattern, parseWords, splitLines } from '../src/pattern.js';

// Deterministic stand-in for canvas text measurement.
const measure = (word) => word.length * 10;

const base = {
  words: ['one', 'two', 'three'],
  width: 400,
  height: 300,
  fontSize: 20,
  iconSize: 10,
  gapX: 10,
  gapY: 10,
};

test('parseWords splits on commas and newlines, trimming blanks', () => {
  assert.deepEqual(parseWords(' a, b ,\n c ,, '), ['a', 'b', 'c']);
});

test('grid mode alternates words and icons on a lattice', () => {
  const { svg, wordCount, iconCount } = buildPattern({ ...base }, measure);
  assert.ok(wordCount > 0 && iconCount > 0);
  // Every lattice site is filled exactly once, by either a word or an icon.
  const words = [...svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)].map((m) => [
    +m[1],
    Math.round((+m[2] - base.fontSize * 0.34) * 100) / 100,
  ]);
  const icons = [...svg.matchAll(/<use [^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  const sites = [...words, ...icons];
  const xs = new Set(sites.map(([x]) => x));
  const ys = new Set(sites.map(([, y]) => y));
  assert.equal(wordCount + iconCount, xs.size * ys.size);
  assert.equal(new Set(sites.map(String)).size, sites.length);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('viewBox="0 0 400 300"'));
  assert.ok(svg.includes('>one</text>'));
  assert.ok(svg.includes('<use href="#pt-icon"'));
});

test('a word cell is flanked by icons above, below, left and right', () => {
  const { svg } = buildPattern({ ...base, words: ['x'] }, measure);
  const doc = svg;
  const words = [...doc.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  const icons = new Set(
    [...doc.matchAll(/<use [^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"/g)].map((m) => `${+m[1]},${+m[2]}`),
  );
  // Half-steps used by the generator for these options.
  const halfX = 10 / 2 + 10 + 10 / 2; // maxWordWidth/2 + gapX + iconSize/2
  const halfY = 20 / 2 + 10 + 10 / 2; // fontSize/2 + gapY + iconSize/2
  const [wx, wyBaseline] = words.find(([x, y]) => x === 200 && Math.abs(y - 150) < 10);
  const wy = wyBaseline - 20 * 0.34; // undo the baseline shift
  for (const [dx, dy] of [[halfX, 0], [-halfX, 0], [0, halfY], [0, -halfY]]) {
    assert.ok(icons.has(`${wx + dx},${wy + dy}`), `expected icon at ${wx + dx},${wy + dy}`);
  }
});

test('words cycle through the list in reading order', () => {
  const { svg } = buildPattern({ ...base, width: 260, height: 120 }, measure);
  const order = [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]);
  order.forEach((word, i) => assert.equal(word, base.words[i % base.words.length]));
});

test('flow mode packs rows using each word width', () => {
  const { wordCount, iconCount } = buildPattern({ ...base, mode: 'flow' }, measure);
  assert.ok(wordCount > 0);
  assert.ok(Math.abs(wordCount - iconCount) <= wordCount);
});

test('rotation wraps the pattern and text is XML-escaped', () => {
  const { svg } = buildPattern({ ...base, words: ['a&b'], rotation: 30 }, measure);
  assert.ok(svg.includes('transform="rotate(30 200 150)"'));
  assert.ok(svg.includes('>a&amp;b</text>'));
});

test('the clip stays upright while the pattern rotates inside it', () => {
  const { svg } = buildPattern({ ...base, rotation: 30 }, measure);
  // clip-path and transform must not share a <g>, or the clip rotates too and
  // slices the corners off the canvas.
  assert.match(svg, /<g clip-path="url\(#pt-clip\)">\s*<g transform="rotate\(30 [^"]*\)">/);
  assert.ok(!/<g clip-path="url\(#pt-clip\)"[^>]*transform=/.test(svg));
});

for (const [mode, rotation] of [
  ['grid', 0], ['grid', 12], ['grid', 45], ['grid', -75], ['grid', 90],
  ['flow', 30], ['flow', -45],
]) {
  test(`${mode} mode covers every canvas corner at ${rotation}°`, () => {
    const opt = { ...base, mode, rotation, words: ['one', 'two three'] };
    const { svg } = buildPattern(opt, measure);
    const cells = [
      ...[...svg.matchAll(/<use [^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"/g)],
      ...[...svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)],
    ].map((m) => [+m[1], +m[2]]);
    const bounds = cells.reduce(
      (acc, [x, y]) => ({
        minX: Math.min(acc.minX, x), maxX: Math.max(acc.maxX, x),
        minY: Math.min(acc.minY, y), maxY: Math.max(acc.maxY, y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    );

    // Un-rotate each canvas corner: that is the area the upright lattice must fill.
    const cx = opt.width / 2;
    const cy = opt.height / 2;
    const t = (-rotation * Math.PI) / 180;
    for (const [px, py] of [[0, 0], [opt.width, 0], [0, opt.height], [opt.width, opt.height]]) {
      const dx = px - cx;
      const dy = py - cy;
      const lx = cx + dx * Math.cos(t) - dy * Math.sin(t);
      const ly = cy + dx * Math.sin(t) + dy * Math.cos(t);
      assert.ok(bounds.minX <= lx && lx <= bounds.maxX, `x ${lx} outside ${bounds.minX}..${bounds.maxX}`);
      assert.ok(bounds.minY <= ly && ly <= bounds.maxY, `y ${ly} outside ${bounds.minY}..${bounds.maxY}`);
    }
  });
}

test('an unrotated canvas is not over-generated', () => {
  const flat = buildPattern({ ...base }, measure);
  const tilted = buildPattern({ ...base, rotation: 45 }, measure);
  assert.ok(
    tilted.wordCount > flat.wordCount,
    'a rotated canvas needs more cells than an upright one',
  );
});

test('transparent background omits the backing rect', () => {
  const opaque = buildPattern({ ...base }, measure).svg;
  const clear = buildPattern({ ...base, transparent: true }, measure).svg;
  assert.ok(opaque.includes('<rect width="400" height="300" fill='));
  assert.ok(!clear.includes('<rect width="400" height="300" fill='));
});

test('splitLines turns a multi-word entry into one line per word', () => {
  assert.deepEqual(splitLines('stay  wild'), ['stay', 'wild']);
  assert.deepEqual(splitLines('hope'), ['hope']);
});

test('a multi-word entry stacks its words, centred on the cell', () => {
  const opt = { ...base, words: ['stay wild'], fontSize: 20, lineHeight: 1.5 };
  const { svg } = buildPattern(opt, measure);
  const cell = svg.match(/<text x="(-?[\d.]+)" y="(-?[\d.]+)">(.*?)<\/text>/);
  const [, anchorX, firstY, body] = cell;
  const spans = [...body.matchAll(/<tspan x="(-?[\d.]+)" y="(-?[\d.]+)">([^<]+)<\/tspan>/g)];
  assert.deepEqual(spans.map((m) => m[3]), ['stay', 'wild']);
  // Both lines share the anchor, and the first tspan sits on the <text> baseline.
  assert.equal(spans[0][1], anchorX);
  assert.equal(spans[1][1], anchorX);
  assert.equal(spans[0][2], firstY);
  // One line step apart, and the stack straddles the cell centre.
  const lineStep = 20 * 1.5;
  assert.equal(+spans[1][2] - +spans[0][2], lineStep);
  const centre = (+spans[0][2] + +spans[1][2]) / 2 - 20 * 0.34;
  const blockHeight = lineStep + 20; // (lines - 1) * lineStep + fontSize
  const halfStepY = blockHeight / 2 + base.gapY + base.iconSize / 2;
  const steps = (centre - base.height / 2) / halfStepY;
  assert.ok(Math.abs(steps - Math.round(steps)) < 1e-6, `cell centre off-lattice: ${centre}`);
});

test('stacked entries make the lattice taller, wider entries make it wider', () => {
  const flat = buildPattern({ ...base, words: ['aa'] }, measure);
  const stacked = buildPattern({ ...base, words: ['aa aa'] }, measure);
  const rowsOf = (svg) => new Set([...svg.matchAll(/<use [^>]*y="(-?[\d.]+)"/g)].map((m) => m[1])).size;
  const colsOf = (svg) => new Set([...svg.matchAll(/<use [^>]*x="(-?[\d.]+)"/g)].map((m) => m[1])).size;
  assert.ok(rowsOf(stacked.svg) < rowsOf(flat.svg), 'taller cells → fewer rows');
  assert.equal(colsOf(stacked.svg), colsOf(flat.svg), 'width comes from the widest line only');
});

test('single-word entries stay plain text with no tspans', () => {
  const { svg } = buildPattern({ ...base }, measure);
  assert.ok(!svg.includes('<tspan'));
});

test('uppercase and custom icon markup are honoured', () => {
  const custom = { markup: '<circle cx="5" cy="5" r="4"/>', viewBox: [0, 0, 10, 10], inheritsColor: true };
  const { svg } = buildPattern({ ...base, uppercase: true, customIcon: custom }, measure);
  assert.ok(svg.includes('>ONE</text>'));
  assert.ok(svg.includes('<circle cx="5" cy="5" r="4"/>'));
});

test('with no custom icon the built-in default is used', () => {
  const { svg } = buildPattern({ ...base }, measure);
  assert.ok(svg.includes(DEFAULT_ICON.markup), 'default icon markup missing');
  // Its box is taller than it is wide, so the longer side sets the icon size and
  // the glyph is centred on its own viewBox rather than on 12,12.
  const [, , boxW, boxH] = DEFAULT_ICON.viewBox;
  const scale = Math.round((base.iconSize / Math.max(boxW, boxH)) * 100) / 100;
  assert.ok(svg.includes(`scale(${scale})`), `expected scale(${scale})`);
  const round = (v) => Math.round(v * 100) / 100;
  assert.ok(svg.includes(`translate(${round(-boxW / 2)} ${round(-boxH / 2)})`));
});

test('the default icon source parses back to the default definition', () => {
  // DEFAULT_ICON_SVG is what the UI shows; DEFAULT_ICON is what the generator
  // draws. They are built from one path, so they must agree.
  const viewBox = DEFAULT_ICON_SVG.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  assert.deepEqual(viewBox, DEFAULT_ICON.viewBox);
  assert.ok(DEFAULT_ICON_SVG.includes(DEFAULT_ICON.markup));
});
