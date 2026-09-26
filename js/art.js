// Procedural avatars and attachment art. Deterministic per seed, pure SVG.
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = (seed) => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) ^ Math.imul(seed ^ (seed >>> 13), 3266489909)) >>> 0) / 4294967296;

export function critter(seed, hue) {
  const r = rng(hash(seed));
  const kinds = ['frog', 'cat', 'bear', 'bot', 'blob', 'owl'];
  const kind = kinds[hash(seed + 'k') % kinds.length];
  const h = hue ?? Math.floor(r() * 360);
  const bg = `hsl(${(h + 180) % 360} 45% 22%)`;
  const body = `hsl(${h} 62% 58%)`;
  const shade = `hsl(${h} 55% 44%)`;
  const cheek = `hsl(${(h + 330) % 360} 80% 72% / .55)`;
  const eyeY = 48 + r() * 4, spread = 12 + r() * 3, look = (r() - 0.5) * 3;
  const eye = (x) => `<circle cx="${x}" cy="${eyeY}" r="6.2" fill="#fff"/><circle cx="${x + look}" cy="${eyeY + 1}" r="3.3" fill="#141414"/><circle cx="${x + look + 1.2}" cy="${eyeY - 0.4}" r="1.1" fill="#fff"/>`;
  let top = '';
  if (kind === 'frog') top = `<circle cx="${50 - spread}" cy="${eyeY - 4}" r="11" fill="${body}"/><circle cx="${50 + spread}" cy="${eyeY - 4}" r="11" fill="${body}"/>`;
  if (kind === 'cat') top = `<path d="M24 40 L28 18 L42 32Z M76 40 L72 18 L58 32Z" fill="${body}"/><path d="M28 30 L29 23 L35 29Z M72 30 L71 23 L65 29Z" fill="${cheek}"/>`;
  if (kind === 'bear') top = `<circle cx="28" cy="30" r="9" fill="${shade}"/><circle cx="72" cy="30" r="9" fill="${shade}"/>`;
  if (kind === 'bot') top = `<path d="M50 22 V12" stroke="${shade}" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="11" r="4" fill="hsl(${(h + 60) % 360} 90% 65%)"/>`;
  if (kind === 'owl') top = `<path d="M26 34 L30 20 L40 30Z M74 34 L70 20 L60 30Z" fill="${shade}"/>`;
  const head = kind === 'bot'
    ? `<rect x="22" y="24" width="56" height="52" rx="16" fill="${body}"/>`
    : kind === 'blob'
      ? `<path d="M50 20c20 0 30 16 30 34s-12 30-30 30-30-12-30-30 10-34 30-34z" fill="${body}"/>`
      : `<ellipse cx="50" cy="58" rx="30" ry="28" fill="${body}"/>`;
  const mouth = r() > 0.5
    ? `<path d="M42 ${eyeY + 14} Q50 ${eyeY + 21} 58 ${eyeY + 14}" fill="none" stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round"/>`
    : `<ellipse cx="50" cy="${eyeY + 16}" rx="4" ry="3" fill="#1a1a1a"/>`;
  return `<svg class="art" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="${bg}"/>
    <ellipse cx="50" cy="96" rx="36" ry="20" fill="${shade}"/>${top}${head}
    <circle cx="${50 - spread - 6}" cy="${eyeY + 11}" r="4.5" fill="${cheek}"/><circle cx="${50 + spread + 6}" cy="${eyeY + 11}" r="4.5" fill="${cheek}"/>
    ${eye(50 - spread)}${eye(50 + spread)}${mouth}</svg>`;
}

// A community tile: layered hills under a sun, tinted by hue.
export function communityTile(seed, hue) {
  const r = rng(hash(seed));
  return `<svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
    <defs><linearGradient id="sky${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 62%)"/><stop offset="1" stop-color="hsl(${hue + 30} 55% 34%)"/></linearGradient></defs>
    <rect width="56" height="56" fill="url(#sky${seed})"/><circle cx="${18 + r() * 20}" cy="18" r="7" fill="hsl(${hue + 40} 90% 85%)"/>
    <path d="M0 40 Q14 ${26 + r() * 8} 28 38 T56 34 V56 H0Z" fill="hsl(${hue + 10} 40% 24%)"/>
    <path d="M0 48 Q18 38 34 46 T56 44 V56 H0Z" fill="hsl(${hue + 20} 45% 16%)"/></svg>`;
}

export function poster() {
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-label="Friday poster">
  <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5f6d"/><stop offset=".55" stop-color="#7b2ff7"/><stop offset="1" stop-color="#0b1026"/></linearGradient>
  <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" opacity=".18"/></pattern></defs>
  <rect width="400" height="300" fill="url(#pg)"/><rect width="400" height="300" fill="url(#dots)"/>
  <circle cx="300" cy="90" r="60" fill="#ffd166" opacity=".9"/><circle cx="300" cy="90" r="60" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="10" stroke-dasharray="2 14"/>
  <path d="M0 220 L80 160 L150 210 L230 140 L320 205 L400 170 V300 H0Z" fill="#0b1026" opacity=".85"/>
  <text x="28" y="92" fill="#fff" font-family="Inter" font-weight="600" font-size="46" letter-spacing="-1">FRIDAY</text>
  <text x="28" y="136" fill="#fff" font-family="Inter" font-weight="600" font-size="46" letter-spacing="-1" opacity=".9">CO-OP</text>
  <text x="30" y="170" fill="#ffd166" font-family="Inter" font-weight="500" font-size="16" letter-spacing="3">8PM · VOICE CHAT · NEW MAP</text></svg>`;
}

export function desk() {
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-label="Desk setup">
  <defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2240"/><stop offset="1" stop-color="#0d1020"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#7b5cff" stop-opacity=".55"/><stop offset="1" stop-color="#7b5cff" stop-opacity="0"/></radialGradient></defs>
  <rect width="400" height="300" fill="url(#wall)"/><rect width="400" height="300" fill="url(#glow)"/>
  <rect x="90" y="60" width="220" height="124" rx="8" fill="#05060c" stroke="#3b3f5c" stroke-width="3"/>
  <rect x="98" y="68" width="204" height="108" rx="3" fill="#10162e"/>
  <rect x="108" y="80" width="90" height="8" rx="3" fill="#56e1b3"/><rect x="108" y="96" width="150" height="6" rx="3" fill="#8aa0ff" opacity=".6"/><rect x="108" y="110" width="120" height="6" rx="3" fill="#ff8fb1" opacity=".6"/><rect x="108" y="124" width="170" height="6" rx="3" fill="#8aa0ff" opacity=".4"/>
  <rect x="190" y="184" width="20" height="26" fill="#2a2e45"/><rect x="0" y="210" width="400" height="90" fill="#171a2c"/>
  <rect x="120" y="228" width="160" height="26" rx="6" fill="#2c3150"/><g fill="#434a73">${Array.from({ length: 12 }, (_, i) => `<rect x="${128 + i * 12.5}" y="234" width="9" height="6" rx="1.5"/>`).join('')}</g>
  <rect x="0" y="206" width="400" height="4" fill="#7b5cff" opacity=".8"/><ellipse cx="320" cy="238" rx="16" ry="10" fill="#2c3150"/></svg>`;
}

// A decorative QR-like grid for the device-link panel (not a real code).
export function linkGrid(seed = 'krypt') {
  const r = rng(hash(seed)); const n = 25; let cells = '';
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#000"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    if (!inFinder && r() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-label="Link code"><g fill="#000">${cells}</g>${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}
