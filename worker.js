// --------------------------------------------------------------------------
// Color Science (same as main thread, duplicated for worker)
// --------------------------------------------------------------------------

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.0031308 ? c * 12.92 * 255 : (1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, v];
}

function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [r * 255, g * 255, b * 255];
}

function rgbToXyz(r, g, b) {
  const rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b);
  return [
    0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl,
    0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl,
    0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl
  ];
}
function xyzToRgb(x, y, z) {
  const rl =  3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gl = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const bl =  0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return [linearToSrgb(rl), linearToSrgb(gl), linearToSrgb(bl)];
}

const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
const LAB_E = 0.008856, LAB_K = 903.3;

function xyzToLab(x, y, z) {
  x /= Xn; y /= Yn; z /= Zn;
  const fx = x > LAB_E ? Math.cbrt(x) : (LAB_K * x + 16) / 116;
  const fy = y > LAB_E ? Math.cbrt(y) : (LAB_K * y + 16) / 116;
  const fz = z > LAB_E ? Math.cbrt(z) : (LAB_K * z + 16) / 116;
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToXyz(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const x = (fx * fx * fx > LAB_E ? fx * fx * fx : (116 * fx - 16) / LAB_K) * Xn;
  const y = (L > LAB_K * LAB_E ? fy * fy * fy : L / LAB_K) * Yn;
  const z = (fz * fz * fz > LAB_E ? fz * fz * fz : (116 * fz - 16) / LAB_K) * Zn;
  return [x, y, z];
}

function labToLch(L, a, b) {
  return [L, Math.sqrt(a * a + b * b), Math.atan2(b, a)];
}
function lchToLab(L, C, h) {
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

// --------------------------------------------------------------------------
// Worker message handler
// --------------------------------------------------------------------------

self.onmessage = function(e) {
  const { type, origBuffer, dlssBuffer, width, height } = e.data;

  if (type === 'compute-merge') {
    const orig = new Uint8ClampedArray(origBuffer);
    const dlss = new Uint8ClampedArray(dlssBuffer);
    const out = new Uint8ClampedArray(orig.length);
    const len = width * height * 4;
    const reportInterval = Math.floor(len / 4 / 20) * 4; // report every 5%

    for (let i = 0; i < len; i += 4) {
      const oR = orig[i], oG = orig[i+1], oB = orig[i+2];
      const dR = dlss[i], dG = dlss[i+1], dB = dlss[i+2];

      // Step 1: Transfer original's HSV saturation to DLSS image
      const [oH_, oS, oV_] = rgbToHsv(oR, oG, oB);
      const [dH, dS_, dV] = rgbToHsv(dR, dG, dB);

      // Luminance-weighted blend for dark/grey safety
      const lumWeight = Math.min(1, oV_ * 2.5);
      const blendedS = dS_ * (1 - lumWeight) + oS * lumWeight;

      let [sR, sG, sB] = hsvToRgb(dH, blendedS, dV);

      // Step 2: Apply original's LCh Lightness at 50%
      const [sX, sY, sZ] = rgbToXyz(sR, sG, sB);
      const [sL, sa, sb] = xyzToLab(sX, sY, sZ);
      const [dL, dC, dHl] = labToLch(sL, sa, sb);

      const [oX, oY, oZ] = rgbToXyz(oR, oG, oB);
      const [oLabL] = xyzToLab(oX, oY, oZ);

      const blendedL = dL * 0.5 + oLabL * 0.5;
      const [, bla, blb] = lchToLab(blendedL, dC, dHl);
      const [lX, lY, lZ] = labToXyz(blendedL, bla, blb);
      let [mR, mG, mB] = xyzToRgb(lX, lY, lZ);

      // Step 3: Darken Only at 50%
      mR = mR * 0.5 + Math.min(mR, oR) * 0.5;
      mG = mG * 0.5 + Math.min(mG, oG) * 0.5;
      mB = mB * 0.5 + Math.min(mB, oB) * 0.5;

      out[i]   = Math.round(Math.max(0, Math.min(255, mR)));
      out[i+1] = Math.round(Math.max(0, Math.min(255, mG)));
      out[i+2] = Math.round(Math.max(0, Math.min(255, mB)));
      out[i+3] = 255;

      // Progress reporting
      if (i % reportInterval === 0) {
        self.postMessage({ type: 'progress', pct: Math.round(i / len * 100) });
      }
    }

    self.postMessage(
      { type: 'merge-done', buffer: out.buffer, width, height },
      [out.buffer]
    );
  }

};
