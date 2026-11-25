import type { CoverPalette } from '../types/music';

export const DEFAULT_PALETTE: CoverPalette = {
  dominant: '#273854',
  vibrant: '#5c84bf',
  muted: '#36465e',
  deep: '#0b0e15',
  dominantRgb: [39, 56, 84],
  vibrantRgb: [92, 132, 191],
  mutedRgb: [54, 70, 94],
  deepRgb: [11, 14, 21],
};

const paletteCache = new Map<string, CoverPalette>();

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

interface ColorBucket {
  rSum: number;
  gSum: number;
  bSum: number;
  count: number;
}

/**
 * Quantizes an album cover image into atmospheric dominant, vibrant, muted, and deep swatches
 * suitable for dark, listening-room backgrounds with accessible foreground text.
 */
export async function extractPaletteFromImage(imageUrl: string): Promise<CoverPalette> {
  if (!imageUrl) return DEFAULT_PALETTE;
  const cached = paletteCache.get(imageUrl);
  if (cached) return cached;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load failed'));
      el.src = imageUrl;
    });

    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_PALETTE;

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<number, ColorBucket>();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 180) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 4-bit per channel quantization
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.rSum += r;
        bucket.gSum += g;
        bucket.bSum += b;
        bucket.count += 1;
      } else {
        buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
      }
    }

    if (buckets.size === 0) return DEFAULT_PALETTE;

    const candidates = Array.from(buckets.values())
      .map((b) => {
        const rgb: [number, number, number] = [
          b.rSum / b.count,
          b.gSum / b.count,
          b.bSum / b.count,
        ];
        const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        return { rgb, h, s, l, count: b.count };
      })
      .sort((a, b) => b.count - a.count);

    // Dominant: top cluster with usable mid-dark luminance
    const dominantCandidate =
      candidates.find((c) => c.l > 0.12 && c.l < 0.82 && c.s > 0.12) || candidates[0];

    // Vibrant: highest saturation × area score with clear luminance
    const vibrantCandidate = [...candidates].sort((a, b) => {
      const scoreA = a.s * (1 - Math.abs(a.l - 0.52) * 1.4) * Math.log2(a.count + 2);
      const scoreB = b.s * (1 - Math.abs(b.l - 0.52) * 1.4) * Math.log2(b.count + 2);
      return scoreB - scoreA;
    })[0];

    // Muted: secondary hue separated from vibrant, calmer saturation
    const mutedCandidate =
      candidates.find((c) => {
        const hueDelta = Math.min(
          Math.abs(c.h - vibrantCandidate.h),
          1 - Math.abs(c.h - vibrantCandidate.h)
        );
        return hueDelta > 0.12 && c.l > 0.14 && c.l < 0.65;
      }) || dominantCandidate;

    const domRgb = hslToRgb(
      dominantCandidate.h,
      clamp(dominantCandidate.s * 0.9, 0.18, 0.68),
      clamp(dominantCandidate.l, 0.2, 0.42)
    );
    const vibRgb = hslToRgb(
      vibrantCandidate.h,
      clamp(vibrantCandidate.s * 1.05, 0.34, 0.84),
      clamp(vibrantCandidate.l, 0.48, 0.68)
    );
    const mutRgb = hslToRgb(
      mutedCandidate.h,
      clamp(mutedCandidate.s * 0.65, 0.14, 0.48),
      clamp(mutedCandidate.l, 0.22, 0.4)
    );
    const deepRgb = hslToRgb(
      dominantCandidate.h,
      clamp(dominantCandidate.s * 0.55, 0.16, 0.44),
      0.065
    );

    const palette: CoverPalette = {
      dominant: rgbToHex(domRgb),
      vibrant: rgbToHex(vibRgb),
      muted: rgbToHex(mutRgb),
      deep: rgbToHex(deepRgb),
      dominantRgb: domRgb,
      vibrantRgb: vibRgb,
      mutedRgb: mutRgb,
      deepRgb,
    };

    paletteCache.set(imageUrl, palette);
    return palette;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function applyPaletteToRoot(palette: CoverPalette): void {
  const root = document.documentElement.style;
  root.setProperty('--c-dominant', palette.dominant);
  root.setProperty('--c-vibrant', palette.vibrant);
  root.setProperty('--c-muted', palette.muted);
  root.setProperty('--c-deep', palette.deep);
  root.setProperty('--c-dominant-rgb', palette.dominantRgb.join(', '));
  root.setProperty('--c-vibrant-rgb', palette.vibrantRgb.join(', '));
  root.setProperty('--c-muted-rgb', palette.mutedRgb.join(', '));
  root.setProperty('--c-deep-rgb', palette.deepRgb.join(', '));
}
