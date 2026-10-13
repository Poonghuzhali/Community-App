/**
 * Generates the Expo icon/splash PNGs (solid brand colour + simple mark) so
 * `expo start` and EAS builds work without design assets.
 *   node scripts/generate-assets.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.resolve(__dirname, '..', 'assets');
const BRAND = [0x1b, 0x4d, 0x3e]; // #1B4D3E

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y += 1) {
    raw[o] = 0; // filter: none
    o += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y, width, height);
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
      o += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Brand background with a rounded "CC" style badge in the centre. */
function badgePixel(cx, cy, radius, inset) {
  return (x, y, w, h) => {
    const dx = x - w / 2;
    const dy = y - h / 2;
    const insideOuter = Math.abs(dx) < w / 2 - inset && Math.abs(dy) < h / 2 - inset;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const insideCircle = dist < radius;
    const ring = dist > radius * 0.62;
    if (insideOuter && insideCircle && ring) return [0xf2, 0xa6, 0x5a]; // accent ring
    if (insideOuter && insideCircle) return [0xff, 0xff, 0xff];
    if (insideOuter) return BRAND;
    return [0x12, 0x36, 0x2b];
  };
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon.png', 1024, 1024, badgePixel(512, 512, 380, 0)],
  ['adaptive-icon.png', 1024, 1024, badgePixel(512, 512, 340, 60)],
  ['splash.png', 1284, 2778, badgePixel(642, 1389, 300, 40)],
  ['favicon.png', 48, 48, badgePixel(24, 24, 18, 0)],
];

for (const [name, w, h, fn] of targets) {
  fs.writeFileSync(path.join(OUT, name), png(w, h, fn));
  console.log(`wrote assets/${name} (${w}x${h})`);
}
