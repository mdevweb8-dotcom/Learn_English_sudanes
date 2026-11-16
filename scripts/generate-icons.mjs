import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', idat), makeChunk('IEND', Buffer.alloc(0))]);
}

function blendPixel(buf, width, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= width) return;
  const idx = (y * width + x) * 4;
  if (idx + 3 >= buf.length) return;
  const alpha = a / 255;
  const inv = 1 - alpha;
  buf[idx] = Math.round(buf[idx] * inv + r * alpha);
  buf[idx + 1] = Math.round(buf[idx + 1] * inv + g * alpha);
  buf[idx + 2] = Math.round(buf[idx + 2] * inv + b * alpha);
  buf[idx + 3] = Math.min(255, Math.round(buf[idx + 3] + a * (1 - buf[idx + 3] / 255)));
}

function renderIcon(size, { maskable = false, round = false, transparentBg = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const scale = size / 512;
  const safeFactor = maskable ? 0.76 : 1.0;
  const offset = (size * (1 - safeFactor)) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      // Background gradient (#1A6FA0 -> #0F4C75)
      const t = (nx + ny) * 0.5;
      const bgR = Math.round(26 * (1 - t) + 15 * t);
      const bgG = Math.round(111 * (1 - t) + 76 * t);
      const bgB = Math.round(160 * (1 - t) + 117 * t);

      let insideBg = true;
      if (round) {
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        insideBg = dx * dx + dy * dy <= 0.49 * 0.49;
      } else if (!maskable && !transparentBg) {
        // Rounded square corner radius ~22%
        const r = 0.22;
        const cx = Math.max(r - nx, 0, nx - (1 - r));
        const cy = Math.max(r - ny, 0, ny - (1 - r));
        insideBg = cx * cx + cy * cy <= r * r;
      }

      if (transparentBg || !insideBg) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
      } else {
        buf[idx] = bgR;
        buf[idx + 1] = bgG;
        buf[idx + 2] = bgB;
        buf[idx + 3] = 255;
      }

      // Subtle inner halo
      const hx = (x - size / 2) / (size * 0.34 * safeFactor);
      const hy = (y - size / 2) / (size * 0.34 * safeFactor);
      if (hx * hx + hy * hy <= 1 && !transparentBg && insideBg) {
        blendPixel(buf, size, x, y, 255, 255, 255, 24);
      }

      // Speech bubble in center
      const sx = (x - offset) / (scale * safeFactor);
      const sy = (y - offset) / (scale * safeFactor);

      // Rounded rect [148..364] x [134..322], r=34
      const rx1 = 148,
        ry1 = 134,
        rx2 = 364,
        ry2 = 322,
        rr = 34;
      const inRect =
        sx >= rx1 &&
        sx <= rx2 &&
        sy >= ry1 &&
        sy <= ry2 &&
        (sx >= rx1 + rr || sy >= ry1 + rr || (sx - (rx1 + rr)) ** 2 + (sy - (ry1 + rr)) ** 2 <= rr * rr) &&
        (sx <= rx2 - rr || sy >= ry1 + rr || (sx - (rx2 - rr)) ** 2 + (sy - (ry1 + rr)) ** 2 <= rr * rr) &&
        (sx >= rx1 + rr || sy <= ry2 - rr || (sx - (rx1 + rr)) ** 2 + (sy - (ry2 - rr)) ** 2 <= rr * rr) &&
        (sx <= rx2 - rr || sy <= ry2 - rr || (sx - (rx2 - rr)) ** 2 + (sy - (ry2 - rr)) ** 2 <= rr * rr);

      // Speech bubble tail triangle: (184,320), (242,320), (184,372)
      const inTail = sx >= 184 && sx <= 242 && sy >= 320 && sy <= 372 && (sy - 320) <= (52 * (242 - sx)) / 58;

      if (inRect || inTail) {
        blendPixel(buf, size, x, y, 255, 255, 255, 255);

        // Draw crisp "FF" / "En" geometric glyph inside bubble in #1A6FA0
        // Letter 'E' (x: 192..242, y: 184..272)
        const inE =
          (sx >= 192 && sx <= 207 && sy >= 184 && sy <= 272) ||
          (sx >= 192 && sx <= 242 && sy >= 184 && sy <= 198) ||
          (sx >= 192 && sx <= 234 && sy >= 221 && sy <= 235) ||
          (sx >= 192 && sx <= 242 && sy >= 258 && sy <= 272);

        // Letter 'n' (x: 262..318, y: 208..272)
        const inN =
          (sx >= 262 && sx <= 276 && sy >= 208 && sy <= 272) ||
          (sx >= 304 && sx <= 318 && sy >= 224 && sy <= 272) ||
          (sx >= 262 && sx <= 318 && sy >= 208 && sy <= 226 && !((sx > 276 && sx < 304 && sy > 220)));

        if (inE || inN) {
          blendPixel(buf, size, x, y, 26, 111, 160, 255);
        }
      }

      // Accent emerald dot at top-right of bubble (368, 144)
      const dx = sx - 368;
      const dy = sy - 144;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 26 * 26) {
        if (distSq <= 19 * 19) {
          blendPixel(buf, size, x, y, 34, 197, 94, 255);
        } else {
          blendPixel(buf, size, x, y, 255, 255, 255, 255);
        }
      }
    }
  }
  return encodePNG(size, size, buf);
}

function renderSplash(width, height) {
  const iconSize = Math.round(Math.min(width, height) * 0.34);
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const t = (x / width + y / height) * 0.5;
      buf[idx] = Math.round(26 * (1 - t) + 15 * t);
      buf[idx + 1] = Math.round(111 * (1 - t) + 76 * t);
      buf[idx + 2] = Math.round(160 * (1 - t) + 117 * t);
      buf[idx + 3] = 255;
    }
  }
  // Draw centered white speech bubble
  const cx = width / 2;
  const cy = height / 2;
  const s = iconSize / 512;
  const startX = cx - 256 * s;
  const startY = cy - 256 * s;
  for (let y = Math.max(0, Math.floor(startY)); y < Math.min(height, Math.ceil(startY + iconSize)); y++) {
    for (let x = Math.max(0, Math.floor(startX)); x < Math.min(width, Math.ceil(startX + iconSize)); x++) {
      const sx = (x - startX) / s;
      const sy = (y - startY) / s;
      const rx1 = 148, ry1 = 134, rx2 = 364, ry2 = 322, rr = 34;
      const inRect =
        sx >= rx1 && sx <= rx2 && sy >= ry1 && sy <= ry2 &&
        (sx >= rx1 + rr || sy >= ry1 + rr || (sx - (rx1 + rr)) ** 2 + (sy - (ry1 + rr)) ** 2 <= rr * rr) &&
        (sx <= rx2 - rr || sy >= ry1 + rr || (sx - (rx2 - rr)) ** 2 + (sy - (ry1 + rr)) ** 2 <= rr * rr) &&
        (sx >= rx1 + rr || sy <= ry2 - rr || (sx - (rx1 + rr)) ** 2 + (sy - (ry2 - rr)) ** 2 <= rr * rr) &&
        (sx <= rx2 - rr || sy <= ry2 - rr || (sx - (rx2 - rr)) ** 2 + (sy - (ry2 - rr)) ** 2 <= rr * rr);
      const inTail = sx >= 184 && sx <= 242 && sy >= 320 && sy <= 372 && (sy - 320) <= (52 * (242 - sx)) / 58;
      if (inRect || inTail) {
        blendPixel(buf, width, x, y, 255, 255, 255, 255);
        const inE =
          (sx >= 192 && sx <= 207 && sy >= 184 && sy <= 272) ||
          (sx >= 192 && sx <= 242 && sy >= 184 && sy <= 198) ||
          (sx >= 192 && sx <= 234 && sy >= 221 && sy <= 235) ||
          (sx >= 192 && sx <= 242 && sy >= 258 && sy <= 272);
        const inN =
          (sx >= 262 && sx <= 276 && sy >= 208 && sy <= 272) ||
          (sx >= 304 && sx <= 318 && sy >= 224 && sy <= 272) ||
          (sx >= 262 && sx <= 318 && sy >= 208 && sy <= 226 && !((sx > 276 && sx < 304 && sy > 220)));
        if (inE || inN) {
          blendPixel(buf, width, x, y, 26, 111, 160, 255);
        }
      }
      const dx = sx - 368;
      const dy = sy - 144;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 26 * 26) {
        blendPixel(buf, width, x, y, distSq <= 19 * 19 ? 34 : 255, distSq <= 19 * 19 ? 197 : 255, distSq <= 19 * 19 ? 94 : 255, 255);
      }
    }
  }
  return encodePNG(width, height, buf);
}

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), renderIcon(192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), renderIcon(512));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), renderIcon(512, { maskable: true }));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderIcon(180));
console.log('Generated PWA PNG icons in public/');

const androidRes = path.resolve('android/app/src/main/res');
if (fs.existsSync(androidRes)) {
  const densities = [
    { name: 'mdpi', size: 48, fg: 108 },
    { name: 'hdpi', size: 72, fg: 162 },
    { name: 'xhdpi', size: 96, fg: 216 },
    { name: 'xxhdpi', size: 144, fg: 324 },
    { name: 'xxxhdpi', size: 192, fg: 432 },
  ];
  for (const d of densities) {
    const dir = path.join(androidRes, `mipmap-${d.name}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), renderIcon(d.size));
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), renderIcon(d.size, { round: true }));
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), renderIcon(d.fg, { maskable: true, transparentBg: true }));
  }
  const drawableDir = path.join(androidRes, 'drawable');
  fs.mkdirSync(drawableDir, { recursive: true });
  fs.writeFileSync(path.join(drawableDir, 'splash.png'), renderSplash(480, 800));
  fs.writeFileSync(path.join(drawableDir, 'ic_stat_notify.png'), renderIcon(96, { maskable: true, transparentBg: true }));
  console.log('Generated Android multi-size mipmap icons, splash.png, and ic_stat_notify.png!');
}
