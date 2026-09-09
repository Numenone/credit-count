/**
 * Draws the app icons from the brand mark.
 *
 * A generator rather than three binary files checked in by hand, so the mark
 * has one definition: change the path here and every size regenerates. The
 * alternative is a favicon that quietly stops matching the logo.
 *
 * No image library. PNG is a handful of length-prefixed, CRC'd chunks around
 * zlib-deflated scanlines, and Node has zlib — reaching for a dependency to
 * write sixty lines of well-specified format is not worth the supply chain.
 *
 * Run: node scripts/build-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

/* ------------------------------------------------------------- the mark -- */

/**
 * The same shape as CoasterMark in src/components/icons.tsx, in its 24×24
 * space: a lift hill, a drop, and an airtime hill.
 *
 * Curves are cubic control points; everything is flattened to a polyline
 * below, because the rasteriser only needs to know how far a pixel is from the
 * line and a fine polyline is indistinguishable from a curve at these sizes.
 */
const PATH = [
  { to: [2, 20] },
  { to: [2, 8.5] },
  { to: [8.4, 3] },
  { to: [8.4, 14.2] },
  { c1: [8.4, 16.2], c2: [9.8, 17.4], to: [11.5, 17.4] },
  { c1: [13.4, 17.4], c2: [14.7, 16], to: [14.7, 14] },
  { to: [14.7, 9.8] },
  { c1: [14.7, 8.4], c2: [15.7, 7.4], to: [17, 7.4] },
  { c1: [18.3, 7.4], c2: [19.3, 8.4], to: [19.3, 9.8] },
  { to: [19.3, 20] },
];

const STROKE = 2.6; // In the same 24-unit space as the component.
const VIEW = 24;

function flatten() {
  const points = [];
  let from = PATH[0].to;
  points.push(from);

  for (const step of PATH.slice(1)) {
    if (!step.c1) {
      points.push(step.to);
      from = step.to;
      continue;
    }
    // 16 samples is far more than these sizes can show.
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      const u = 1 - t;
      points.push([
        u ** 3 * from[0] + 3 * u * u * t * step.c1[0] + 3 * u * t * t * step.c2[0] + t ** 3 * step.to[0],
        u ** 3 * from[1] + 3 * u * u * t * step.c1[1] + 3 * u * t * t * step.c2[1] + t ** 3 * step.to[1],
      ]);
    }
    from = step.to;
  }
  return points;
}

const POLYLINE = flatten();

/**
 * The mark's real extent, including the stroke's own width.
 *
 * Framing by the nominal 24-unit box wastes the empty margin the path happens
 * to have — at 16 pixels that left the mark seven pixels tall inside a sixteen
 * pixel square, and a favicon nobody can make out is decoration. Fitting the
 * ink instead means every size uses the room it has.
 */
const INK = POLYLINE.reduce(
  (box, [x, y]) => ({
    minX: Math.min(box.minX, x - STROKE / 2),
    minY: Math.min(box.minY, y - STROKE / 2),
    maxX: Math.max(box.maxX, x + STROKE / 2),
    maxY: Math.max(box.maxY, y + STROKE / 2),
  }),
  { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
);
const INK_W = INK.maxX - INK.minX;
const INK_H = INK.maxY - INK.minY;

/** Distance from a point to a line segment. */
function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/* ---------------------------------------------------------- rasterising -- */

/**
 * Coverage of one pixel, sampled 3×3 and averaged.
 *
 * Anti-aliasing matters more here than anywhere else in the app: at 16 pixels
 * a hard-edged diagonal is a staircase, and a staircase is what makes a
 * favicon look like a mistake.
 */
function coverage(px, py, scale, offsetX, offsetY) {
  const half = STROKE / 2;
  let hits = 0;

  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      // Sample at thirds of the pixel, converted back into mark space.
      const x = (px + (sx + 0.5) / 3 - offsetX) / scale;
      const y = (py + (sy + 0.5) / 3 - offsetY) / scale;

      let nearest = Infinity;
      for (let i = 1; i < POLYLINE.length; i++) {
        nearest = Math.min(nearest, distanceToSegment(x, y, POLYLINE[i - 1], POLYLINE[i]));
        if (nearest <= half) break;
      }
      if (nearest <= half) hits += 1;
    }
  }
  return hits / 9;
}

function render(size, { background, ink, radius, margin = 0.11 }) {
  // A margin so the mark is not flush to the tab's edge, then the ink centred
  // in whatever is left — fitted on its longer side so it never overflows.
  const usable = size * (1 - margin * 2);
  const scale = Math.min(usable / INK_W, usable / INK_H);
  const offsetX = (size - INK_W * scale) / 2 - INK.minX * scale;
  const offsetY = (size - INK_H * scale) / 2 - INK.minY * scale;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Rounded-square background, anti-aliased at the corners the same way.
      let bgAlpha = 1;
      if (radius > 0) {
        const cx = Math.min(x + 0.5, size - x - 0.5);
        const cy = Math.min(y + 0.5, size - y - 0.5);
        if (cx < radius && cy < radius) {
          const d = Math.hypot(radius - cx, radius - cy);
          bgAlpha = Math.max(0, Math.min(1, radius - d + 0.5));
        }
      }

      const markAlpha = coverage(x, y, scale, offsetX, offsetY);

      // The mark over the background, both premultiplied into straight RGBA.
      const r = background[0] * (1 - markAlpha) + ink[0] * markAlpha;
      const g = background[1] * (1 - markAlpha) + ink[1] * markAlpha;
      const b = background[2] * (1 - markAlpha) + ink[2] * markAlpha;

      pixels[i] = Math.round(r);
      pixels[i + 1] = Math.round(g);
      pixels[i + 2] = Math.round(b);
      pixels[i + 3] = Math.round(255 * bgAlpha);
    }
  }
  return pixels;
}

/* ------------------------------------------------------------------ png -- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // 10-12: compression, filter and interlace methods, all zero.

  // Each scanline is prefixed with its filter type. Zero — "none" — because
  // these images are tiny and the saving from a real filter is not worth the
  // code that would have to be right.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ ico -- */

/** An ICO wrapping PNGs. Every browser that still wants .ico reads these. */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = [];
  for (const { size, data } of entries) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 means 256
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    directory.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...directory, ...entries.map((e) => e.data)]);
}

/* ----------------------------------------------------------------- build -- */

// The brand orange, and the ink it sits on. Light-mode values: a favicon is
// drawn against the browser's chrome, which is not the page.
const BRAND = [0xb8, 0x39, 0x1b];
const CREAM = [0xff, 0xfb, 0xf6];

const sizes = [16, 32, 48];
const icoEntries = sizes.map((size) => ({
  size,
  data: png(
    size,
    render(size, { background: CREAM, ink: BRAND, radius: size * 0.22 }),
  ),
}));

writeFileSync("src/app/favicon.ico", ico(icoEntries));

// Apple wants a square, opaque, 180px icon and applies its own mask.
const apple = 180;
writeFileSync(
  "src/app/apple-icon.png",
  png(apple, render(apple, { background: BRAND, ink: CREAM, radius: 0, margin: 0.2 })),
);

console.log(
  `favicon.ico  ${sizes.join(", ")}px  ${icoEntries.reduce((n, e) => n + e.data.length, 0)} bytes\n` +
    `apple-icon.png  ${apple}px`,
);
