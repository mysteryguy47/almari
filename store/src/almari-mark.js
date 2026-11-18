// The almari mark, as SVG parts, in a 1024 box. Same geometry as the original
// launcher icon (body 248..776 x 155..832), with depth: a soft gradient on the
// steel, recessed door panels, brass with a highlight, and a real keyhole.
function almariMark({ bg = true, shadow = true, layer = 'all', scale = 1 } = {}) {
  const defs = `
  <defs>
    <radialGradient id="bg" cx="30%" cy="18%" r="95%">
      <stop offset="0" stop-color="#4A7563"/>
      <stop offset="0.55" stop-color="#34574A"/>
      <stop offset="1" stop-color="#25423A"/>
    </radialGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFCF5"/>
      <stop offset="1" stop-color="#EDE4D2"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F3ECDD"/>
      <stop offset="1" stop-color="#E6DBC6"/>
    </linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#F0D7A4"/>
      <stop offset="0.45" stop-color="#D6B378"/>
      <stop offset="1" stop-color="#A9864C"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#0E1C16" flood-opacity="0.38"/>
    </filter>
    <filter id="floor" x="-50%" y="-200%" width="200%" height="500%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>`;
  const background = bg ? `<rect width="1024" height="1024" fill="url(#bg)"/>` : '';
  const floor = shadow ? `<ellipse cx="512" cy="884" rx="292" ry="20" fill="#0E1C16" opacity="0.42" filter="url(#floor)"/>` : '';
  const door = (x) => `
    <rect x="${x}" y="193" width="194" height="601" rx="44" fill="#34574A"/>
    <rect x="${x + 15}" y="208" width="164" height="571" rx="31" fill="url(#panel)"/>`;
  const handle = (x) => `
    <rect x="${x}" y="430" width="27" height="112" rx="13.5" fill="url(#brass)"/>
    <rect x="${x + 6}" y="440" width="6" height="88" rx="3" fill="#FFF3D6" opacity="0.7"/>`;
  const fg = `
    ${floor}
    <rect x="296" y="820" width="58" height="62" rx="12" fill="#D9CFBA"/>
    <rect x="670" y="820" width="58" height="62" rx="12" fill="#D9CFBA"/>
    <g ${shadow ? 'filter="url(#lift)"' : ''}>
      <rect x="248" y="155" width="528" height="677" rx="66" fill="url(#steel)"/>
    </g>
    <rect x="264" y="165" width="496" height="40" rx="20" fill="url(#gloss)" opacity="0.6"/>
    ${door(288)}
    ${door(542)}
    <rect x="505" y="155" width="14" height="677" fill="#2B493E"/>
    ${handle(458)}
    ${handle(539)}
    <rect x="533" y="566" width="38" height="56" rx="13" fill="url(#brass)"/>
    <circle cx="552" cy="586" r="7.5" fill="#2A3B33"/>
    <path d="M548.5 588 h7 l2.5 18 h-12 z" fill="#2A3B33"/>`;
  // Scaled about the mark's centre, for launcher layers that are masked to a circle.
  const placed = scale === 1 ? fg : `<g transform="translate(512 515) scale(${scale}) translate(-512 -518.5)">${fg}</g>`;
  if (layer === 'background') return { defs, body: background };
  if (layer === 'foreground') return { defs, body: placed };
  return { defs, body: background + placed };
}
module.exports = { almariMark };
