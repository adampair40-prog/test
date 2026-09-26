// Krypt palettes, ported from the client (src/ui/theme.cpp).
// Each preset is a complete light/dark family; custom colours are generated in OKLab
// exactly like the client, so a colour picked here produces the same surfaces there.

const RAMP_KEYS = ['well', 'canvas', 'chrome', 'raised', 'inset', 'hover', 'selected',
  'text', 'secondary', 'muted', 'disabled', 'accent'];

const ramp = (values) => Object.fromEntries(RAMP_KEYS.map((k, i) => [k, values[i]]));

export const PRESETS = [
  { id: 'midnight', name: 'Midnight', rgb: 0xE5383B, description: 'Ink-navy surfaces with a crimson signal',
    dark: ramp([0x10131B, 0x1B2030, 0x161A25, 0x222838, 0x1A1F2C, 0x262D3E, 0x2C3447, 0xEEF1F7, 0xC3C9D6, 0x9AA3B5, 0x6B7386, 0xE5383B]),
    light: ramp([0xD6DAE4, 0xF3F5F9, 0xE6E9F0, 0xFCFDFF, 0xECEFF5, 0xE0E5EE, 0xD2D8E4, 0x1A2030, 0x3E475C, 0x4E586E, 0x8790A3, 0xC0262B]) },
  { id: 'fern', name: 'Fern', rgb: 0xD6F7A7, description: 'Forest surfaces with fresh fern highlights',
    dark: ramp([0x0B1511, 0x15231C, 0x101C16, 0x203127, 0x19291F, 0x2B4132, 0x38533C, 0xF0F6EB, 0xC4D2C0, 0xA5B79F, 0x738570, 0xD6F7A7]),
    light: ramp([0xD5E2CE, 0xF2F7EE, 0xE4EEDF, 0xFBFDF8, 0xEAF2E4, 0xDEECD5, 0xCDE2BD, 0x1B301D, 0x3D573B, 0x4B6547, 0x82967A, 0x3F672A]) },
  { id: 'cobalt', name: 'Cobalt', rgb: 0x5890FF, description: 'Ink-blue surfaces with clear cobalt highlights',
    dark: ramp([0x0B1220, 0x152238, 0x101B2D, 0x20324C, 0x192A42, 0x2B4262, 0x36547A, 0xEEF4FF, 0xC1D0E7, 0xA2B7D5, 0x7087A8, 0x9AC2FF]),
    light: ramp([0xD1DFF2, 0xF0F5FD, 0xE1EBF9, 0xFAFCFF, 0xE8F0FC, 0xD9E7FB, 0xC7DAF6, 0x172D4C, 0x3B5577, 0x496386, 0x8094B1, 0x285AB0]) },
  { id: 'iris', name: 'Iris', rgb: 0xAC80F4, description: 'Indigo-violet surfaces with soft iris highlights',
    dark: ramp([0x120E20, 0x231C35, 0x1B152B, 0x302743, 0x29213B, 0x41355A, 0x51436F, 0xF5F0FF, 0xD2C6E5, 0xB9A8D1, 0x87769F, 0xCCB2FF]),
    light: ramp([0xDED5EE, 0xF6F2FC, 0xEBE3F7, 0xFDFBFF, 0xF0EAF9, 0xE7DDF5, 0xD9C9EF, 0x2E2046, 0x56446E, 0x67517F, 0x9987B0, 0x6C43A9]) },
  { id: 'rose', name: 'Rose', rgb: 0xE78DC1, description: 'Plum surfaces with warm rose highlights',
    dark: ramp([0x1B0E17, 0x301C29, 0x261521, 0x3E2836, 0x362230, 0x523747, 0x644456, 0xFFF0F6, 0xE3C5D4, 0xCDA8BD, 0x9D778B, 0xF5B3D5]),
    light: ramp([0xEAD4DF, 0xFCF2F6, 0xF5E2EB, 0xFFFAFC, 0xF9EAF0, 0xF2DAE6, 0xEAC5D8, 0x452335, 0x71465C, 0x80536A, 0xAE879B, 0x9F396C]) },
  { id: 'amber', name: 'Amber', rgb: 0xFFA166, description: 'Bronze surfaces with warm amber highlights',
    dark: ramp([0x1A120C, 0x2C2118, 0x231A12, 0x3B2D21, 0x33261B, 0x4F3D2C, 0x614C35, 0xFFF4E8, 0xDFCCB8, 0xC6AF94, 0x998168, 0xFFC28A]),
    light: ramp([0xE9DBCA, 0xFBF5ED, 0xF3E8DA, 0xFFFCF7, 0xF7EDDF, 0xF0E0CA, 0xE9D2B1, 0x3F2B19, 0x695039, 0x795E41, 0xA58E72, 0x91531C]) },
  { id: 'lagoon', name: 'Lagoon', rgb: 0x40CDD0, description: 'Deep teal surfaces with luminous aqua highlights',
    dark: ramp([0x091717, 0x112829, 0x0D2022, 0x1C3638, 0x162E30, 0x26494B, 0x315C5E, 0xEAF8F6, 0xBBD9D5, 0x98BFBB, 0x678F8C, 0x85E1D8]),
    light: ramp([0xCBE4DF, 0xEFF8F5, 0xDEF0EB, 0xF9FEFC, 0xE5F4EF, 0xD1EBE4, 0xBDE0D6, 0x163732, 0x355E57, 0x436F65, 0x7BA096, 0x166E65]) },
  { id: 'graphite', name: 'Graphite', rgb: 0xB8B8B8, description: 'Deep charcoal surfaces with soft silver highlights',
    dark: ramp([0x131313, 0x202020, 0x191919, 0x2B2B2B, 0x242424, 0x343434, 0x414141, 0xF0F0F0, 0xCCCCCC, 0xAEAEAE, 0x838383, 0xC7C7C7]),
    light: ramp([0xD8D8D8, 0xF4F4F4, 0xE9E9E9, 0xFDFDFD, 0xECECEC, 0xE0E0E0, 0xD1D1D1, 0x202020, 0x494949, 0x5A5A5A, 0x929292, 0x484848]) },
];

// ---------------------------------------------------------------- colour maths

const toRgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const toInt = ([r, g, b]) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
export const parseHex = (s) => parseInt(s.replace('#', ''), 16) & 0xFFFFFF;

const linear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const luminance = (n) => {
  const [r, g, b] = toRgb(n).map((c) => linear(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
export const mix = (a, b, t) => {
  const x = toRgb(a), y = toRgb(b);
  return toInt(x.map((v, i) => v + (y[i] - v) * t));
};

// Pushes ink toward black or white until it reads on every surface (client: readable_on).
function readableOn(ink, surfaces, light, target) {
  const pole = light ? 0x000000 : 0xFFFFFF;
  for (let step = 0; step <= 40; step++) {
    const candidate = mix(ink, pole, step / 40);
    if (surfaces.every((s) => contrast(candidate, s) >= target)) return candidate;
  }
  return pole;
}

// OKLab tonal generator (client: build_palette, generated branch).
function generator(rgb) {
  const [r, g, b] = toRgb(rgb).map((c) => linear(c / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const t = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const ca = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * t;
  const cb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * t;
  const chroma = Math.hypot(ca, cb);
  const srgb = (c) => { c = Math.min(1, Math.max(0, c)); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };
  return (lum, tint) => {
    const amount = tint / Math.max(0.12, chroma);
    const raw = (scale) => {
      const a = ca * amount * scale, bb = cb * amount * scale;
      const x = (lum + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
      const y = (lum - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
      const z = (lum - 0.0894841775 * a - 1.2914855480 * bb) ** 3;
      return [4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
        -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
        -0.0041960863 * x - 0.7034186147 * y + 1.7076147010 * z];
    };
    const inGamut = (c) => c.every((v) => v >= 0 && v <= 1);
    let c = raw(1);
    if (!inGamut(c)) {
      let low = 0, high = 1;
      for (let i = 0; i < 14; i++) { const mid = (low + high) / 2; if (inGamut(raw(mid))) low = mid; else high = mid; }
      c = raw(low);
    }
    return toInt(c.map(srgb));
  };
}

export function buildPalette({ preset = 'midnight', custom = null, accent = null, light = false }) {
  const base = PRESETS.find((p) => p.id === preset) || PRESETS[0];
  const r = light ? base.light : base.dark;
  const p = {
    well: r.well, canvas: r.canvas, chrome: r.chrome, raised: r.raised, inset: r.inset, hover: r.hover,
    selected: r.selected, text: r.text, secondary: r.secondary, muted: r.muted, disabled: r.disabled, accent: r.accent,
  };
  if (custom != null) {
    const tone = generator(custom);
    p.well = tone(light ? 0.88 : 0.18, 0.035);
    p.canvas = tone(light ? 0.975 : 0.24, light ? 0.012 : 0.035);
    p.chrome = tone(light ? 0.935 : 0.215, 0.03);
    p.raised = tone(light ? 0.995 : 0.29, light ? 0.005 : 0.035);
    p.inset = tone(light ? 0.96 : 0.265, 0.025);
    p.hover = tone(light ? 0.92 : 0.34, 0.04);
    p.selected = tone(light ? 0.875 : 0.39, 0.05);
    p.text = tone(light ? 0.22 : 0.96, 0.012);
    p.secondary = tone(light ? 0.38 : 0.84, 0.025);
    p.muted = tone(light ? 0.44 : 0.75, 0.03);
    p.disabled = tone(light ? 0.62 : 0.60, 0.025);
    p.accent = custom;
  }
  if (accent != null) p.accent = accent;
  const surfaces = [p.well, p.canvas, p.chrome, p.raised, p.inset, p.hover, p.selected];
  p.text = readableOn(p.text, surfaces, light, 7);
  p.secondary = readableOn(p.secondary, surfaces, light, 4.5);
  p.muted = readableOn(p.muted, surfaces, light, 4.5);
  p.disabled = readableOn(p.disabled, surfaces, light, 3);
  const onAccent = contrast(p.accent, 0x000000) >= contrast(p.accent, 0xFFFFFF) ? 0x111111 : 0xFFFFFF;
  const pole = onAccent === 0xFFFFFF ? 0x000000 : 0xFFFFFF;
  const readable = surfaces.every((s) => contrast(p.accent, s) >= 4.5);
  p.accentText = readable ? p.accent : readableOn(p.accent, surfaces, light, 4.5);
  p.onAccent = onAccent;
  p.accentHover = mix(p.accent, pole, 0.12);
  p.accentPress = mix(p.accent, pole, 0.22);
  p.presence = light ? 0x125B40 : 0x7EE0AE;
  p.success = light ? 0x285E1E : 0xB5E69F;
  p.warning = light ? 0x754507 : 0xFFD28E;
  p.danger = light ? 0x9C2429 : 0xFF8F87;
  p.dangerSolid = light ? 0xB12D2B : 0xC23B37;
  return p;
}

// Writes the palette to CSS custom properties on :root.
export function applyPalette(p, light) {
  const root = document.documentElement.style;
  const set = (name, value) => root.setProperty(name, hex(value));
  set('--well', p.well); set('--bg', p.canvas); set('--chrome', p.chrome); set('--surface', p.raised);
  set('--sunken', p.inset); set('--hover', p.hover); set('--active', p.selected);
  set('--text', p.text); set('--text-2', p.secondary); set('--text-3', p.muted); set('--text-4', p.disabled);
  set('--accent', p.accent); set('--accent-hover', p.accentHover); set('--accent-press', p.accentPress);
  set('--accent-text', p.accentText); set('--on-accent', p.onAccent);
  set('--presence', p.presence); set('--success', p.success); set('--warning', p.warning);
  set('--danger', p.danger); set('--danger-solid', p.dangerSolid);
  const [ar, ag, ab] = toRgb(p.accent);
  root.setProperty('--accent-rgb', `${ar} ${ag} ${ab}`);
  const [tr, tg, tb] = toRgb(p.text);
  root.setProperty('--text-rgb', `${tr} ${tg} ${tb}`);
  const [wr, wg, wb] = toRgb(p.well);
  root.setProperty('--well-rgb', `${wr} ${wg} ${wb}`);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex(p.chrome));
}
