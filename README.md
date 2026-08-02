# PatternText

Browser app: comma-separated word list in, seamless SVG pattern out.

Words and one repeating icon sit on a checkerboard lattice, so every word is
flanked by an icon above, below, left and right:

```
      <>
 <>  word  <>
      <>
```

Words are handed out in reading order and cycle through the list forever, which
staggers them into diagonals across the canvas.

An entry containing a space is one cell with its words stacked, centred:

```
      <>
 <>  stay  <>
     wild
      <>
```

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
npm test         # pattern generator unit tests (node:test)
```

## Controls

- **Words** — comma (or newline) separated; the list repeats. Spaces inside an
  entry stack it: `stay wild` renders as two lines in one cell, `stay, wild` as
  two separate cells.
- **Icon** — 16 built-ins, or paste your own path data / a whole `<svg>` into the
  custom field (scripts, `<image>` and `<use>` are stripped before inlining).
- **Layout** — `Grid` aligns every cell to a strict lattice (cell width = widest
  word), `Flow` packs each row by real word width and offsets alternate rows.
  Canvas size, gaps and rotation live here too.
- **Type / Icon size / Colours** — font, size, weight, tracking, leading (line
  spacing for stacked entries), uppercase, icon size, stroke width, icon tilt,
  and the three colours (transparent bg optional).

Settings persist in `localStorage`; **Reset** clears them.

## Export

`Download SVG` (text stays live `<text>`, so the font must exist on the viewing
machine — convert to outlines in a vector editor if that matters),
`Download PNG` (2×), or `Copy SVG` to the clipboard.

## Layout math

```
lineStep    = fontSize * lineHeight
blockHeight = (maxLines - 1) * lineStep + fontSize   // tallest stacked entry
halfStepX   = maxEntryWidth / 2 + gapX + iconSize / 2  // cell centre → icon centre
halfStepY   = blockHeight    / 2 + gapY + iconSize / 2
cell(col, row) = (col + row) even ? next entry : icon
```

A cell is as wide as the widest line of the widest entry, so one stacked entry
opens up the whole lattice — it stays regular.

Rotation happens after the lattice is laid out, so the lattice has to cover the
canvas rotated the *other* way — the canvas corners mapped back into lattice
space:

```
reachX = (w/2)·|cos θ| + (h/2)·|sin θ| + maxEntryWidth / 2
reachY = (w/2)·|sin θ| + (h/2)·|cos θ| + blockHeight    / 2
```

The clip rect lives on an outer `<g>` and the rotation on an inner one; putting
both on the same group rotates the clip along with the pattern and shaves the
corners off.

Word widths come from canvas `measureText` with the same font string the SVG
uses. [src/pattern.js](src/pattern.js) is pure — it takes a `measure(word)`
function — which is what the tests drive.
