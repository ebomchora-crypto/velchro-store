/* Garment renderer: builds layered SVG clothes (hanger, fabric shading, prints) in a 400x520 box.
   The hook pivot sits at (200, 22) so the rack can hang every piece from the rail. */
(function () {
  let uid = 0;
  const FONT_BLACK = "'Archivo Black','Archivo','Helvetica Neue',Arial,sans-serif";
  const FONT_REG = "'Archivo','Helvetica Neue',Arial,sans-serif";

  const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${400 - x},${y}`);
  const rib = (d, w = 9) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="${w}"/><path d="${d}" fill="none" stroke="url(#rib)" stroke-width="${w}"/>`;
  const stitch = (d, o = 0.55) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="1.1" stroke-dasharray="3.2 3"/>`;

  const SPECS = {
    tee: {
      hem: 482,
      neck: (b) => `M160,96 Q200,${b ? 118 : 170} 240,96`,
      body: (b) => `M160,96 L86,124 L30,198 L62,236 L108,206 L108,468 Q200,482 292,468 L292,206 L338,236 L370,198 L314,124 L240,96 Q200,${b ? 118 : 170} 160,96 Z`,
      under: () => '',
      over(p, b) {
        const arm = 'M108,206 Q104,160 90,126';
        return [
          `<path d="M160,96 Q200,116 240,96 Q200,170 160,96Z" fill="#000" opacity="${b ? 0 : .38}"/>`,
          rib(this.neck(b), 10),
          `<path d="${arm}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.2"/>`,
          `<path d="${mirror(arm)}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.2"/>`,
          stitch('M112,452 Q200,465 288,452'),
          stitch('M40,200 L67,231'), stitch(mirror('M40,200 L67,231')),
        ].join('');
      },
      folds: ['M150,140 Q138,300 156,470', 'M250,150 Q264,300 244,470', 'M200,175 Q194,330 206,476', 'M58,205 Q82,222 104,210', 'M342,205 Q318,222 296,210'],
    },

    long: {
      hem: 488,
      neck: (b) => `M160,96 Q200,${b ? 118 : 168} 240,96`,
      body: (b) => `M160,96 L86,124 L52,160 L30,350 L72,358 L108,226 L108,474 Q200,488 292,474 L292,226 L328,358 L370,350 L348,160 L314,124 L240,96 Q200,${b ? 118 : 168} 160,96 Z`,
      under: () => '',
      over(p, b) {
        const arm = 'M108,226 Q102,170 88,126';
        const cuff = 'M31,336 L73,344';
        return [
          `<path d="M160,96 Q200,116 240,96 Q200,168 160,96Z" fill="#000" opacity="${b ? 0 : .38}"/>`,
          rib(this.neck(b), 10),
          `<path d="${arm}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.2"/>`,
          `<path d="${mirror(arm)}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.2"/>`,
          `<path d="M28,352 L31,332 L75,340 L72,360Z" fill="#000" fill-opacity=".14"/><path d="M28,352 L31,332 L75,340 L72,360Z" fill="url(#rib)"/>`,
          `<path d="${mirror('M28,352 L31,332 L75,340 L72,360Z')}" fill="#000" fill-opacity=".14"/><path d="${mirror('M28,352 L31,332 L75,340 L72,360Z')}" fill="url(#rib)"/>`,
          stitch('M112,458 Q200,472 288,458'),
        ].join('');
      },
      folds: ['M150,140 Q138,300 156,476', 'M250,150 Q264,300 244,476', 'M200,175 Q194,330 206,482', 'M60,170 Q54,250 44,330', 'M340,170 Q346,250 356,330'],
    },

    tank: {
      hem: 482,
      neck: () => 'M172,92 Q200,166 228,92',
      body: (b) => `M148,92 L172,92 Q200,${b ? 122 : 166} 228,92 L252,92 L266,150 Q254,190 266,226 L266,470 Q200,482 134,470 L134,226 Q146,190 134,150 Z`,
      under: () => '',
      over(p, b) {
        return [
          `<path d="M172,92 Q200,166 228,92 L228,92 Q200,${b ? 122 : 120} 172,92Z" fill="#000" opacity="${b ? 0 : .35}"/>`,
          rib(`M172,92 Q200,${b ? 122 : 166} 228,92`, 7),
          rib('M138,152 Q150,190 138,226', 6), rib('M262,152 Q250,190 262,226', 6),
          stitch('M138,452 Q200,464 262,452'),
        ].join('');
      },
      folds: ['M170,180 Q160,320 170,470', 'M232,180 Q242,320 230,470', 'M200,180 Q198,330 202,476'],
    },

    hoodie: {
      hem: 486,
      neck: () => 'M150,104 Q200,150 250,104',
      body: () => 'M150,104 L82,134 L44,166 L26,380 L78,390 L104,250 L104,462 Q200,476 296,462 L296,250 L322,390 L374,380 L356,166 L318,134 L250,104 Q200,150 150,104 Z',
      under: () => '',
      behind: (p, b) => b
        ? `<path d="M136,112 Q104,34 200,30 Q296,34 264,112 Q200,134 136,112Z" fill="${p.color}"/>`
        : `<path d="M136,112 Q108,34 200,32 Q292,34 264,112 Z" fill="${p.color}"/>
           <path d="M136,112 Q108,34 200,32 Q292,34 264,112 Z" fill="url(#sheen)"/>
           <path d="M152,106 Q156,60 200,56 Q244,60 248,106 Q200,150 152,106Z" fill="#000" opacity=".5"/>
           <path d="M152,106 Q156,60 200,56 Q244,60 248,106 Q200,150 152,106Z" fill="#fff" opacity=".04"/>
           <path d="M148,108 Q150,52 200,50 Q250,52 252,108" fill="none" stroke="${p.color}" stroke-width="9"/>
           <path d="M148,108 Q150,52 200,50 Q250,52 252,108" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="9"/>
           <path d="M152,100 Q156,58 200,54" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>`,
      over(p, b) {
        const cream = p.trim || '#efe9d6';
        const pocket = 'M126,350 L274,350 L292,446 L108,446 Z';
        const cuffR = 'M26,368 L78,378 L72,402 L22,392Z';
        const parts = [];
        if (b) {
          parts.push(
            `<path d="M136,112 Q104,34 200,30 Q296,34 264,112 Q200,134 136,112Z" fill="#000" opacity=".12"/>`,
            `<path d="M200,34 Q196,80 200,128" stroke="#000" stroke-opacity=".2" stroke-width="1.4" fill="none"/>`,
            stitch('M142,108 Q200,130 258,108', .4),
          );
        } else {
          parts.push(
            `<path d="M180,128 L176,214 M220,128 L224,214" stroke="${cream}" stroke-width="3.2" stroke-linecap="round"/>`,
            `<rect x="173.5" y="212" width="5" height="12" rx="2" fill="#16150f"/><rect x="221.5" y="212" width="5" height="12" rx="2" fill="#16150f"/>`,
            `<circle cx="180" cy="124" r="3.2" fill="#16150f"/><circle cx="220" cy="124" r="3.2" fill="#16150f"/>`,
            `<path d="${pocket}" fill="#000" fill-opacity=".05" stroke="#000" stroke-opacity=".22" stroke-width="1.4"/>`,
            stitch(pocket.replace('M126,350', 'M128,354'), .4),
          );
        }
        parts.push(
          `<path d="M104,436 Q200,450 296,436 L296,462 Q200,476 104,462Z" fill="#000" fill-opacity=".14"/><path d="M104,436 Q200,450 296,436 L296,462 Q200,476 104,462Z" fill="url(#rib)"/>`,
          `<path d="${cuffR}" fill="#000" fill-opacity=".14"/><path d="${cuffR}" fill="url(#rib)"/>`,
          `<path d="${mirror(cuffR)}" fill="#000" fill-opacity=".14"/><path d="${mirror(cuffR)}" fill="url(#rib)"/>`,
          `<path d="M104,250 Q100,190 82,136" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/><path d="${mirror('M104,250 Q100,190 82,136')}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/>`,
        );
        return parts.join('');
      },
      folds: ['M150,150 Q134,300 152,440', 'M250,150 Q266,300 248,440', 'M200,220 Q196,330 204,436', 'M60,190 Q54,280 44,370', 'M340,190 Q346,280 356,370', 'M110,330 Q150,350 190,352'],
    },

    jersey: {
      hem: 482,
      neck: () => 'M165,96 L200,150 L235,96',
      body: () => 'M165,96 L96,122 L46,176 L70,222 L112,196 L112,470 Q200,482 288,470 L288,196 L330,222 L354,176 L304,122 L235,96 L200,150 Z',
      under: (p) => {
        const t = p.trim || '#12110f';
        return `<path d="M112,196 L132,196 L132,474 L112,474Z" fill="${t}"/><path d="${mirror('M112,196 L132,196 L132,474 L112,474Z')}" fill="${t}"/>`;
      },
      over(p, b) {
        const t = p.trim || '#12110f';
        const vee = b ? 'M165,96 Q200,116 235,96' : 'M165,96 L200,150 L235,96';
        return [
          `<rect x="0" y="0" width="400" height="520" fill="url(#mesh)"/>`,
          `<path d="${vee}" fill="none" stroke="${t}" stroke-width="12" stroke-linejoin="miter"/>`,
          `<path d="M52,186 L76,216" stroke="${t}" stroke-width="12"/><path d="${mirror('M52,186 L76,216')}" stroke="${t}" stroke-width="12"/>`,
          `<path d="M60,200 L84,230" stroke="${t}" stroke-width="3"/><path d="${mirror('M60,200 L84,230')}" stroke="${t}" stroke-width="3"/>`,
          `<path d="M112,196 Q104,160 96,124" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/><path d="${mirror('M112,196 Q104,160 96,124')}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/>`,
          `<path d="M112,462 Q200,474 288,462 L288,470 Q200,482 112,470Z" fill="${t}"/>`,
        ].join('');
      },
      folds: ['M150,140 Q140,300 156,470', 'M250,140 Q262,300 244,470', 'M200,190 Q196,330 204,478'],
    },

    varsity: {
      hem: 486,
      neck: () => 'M150,94 Q200,120 250,94',
      torso: 'M158,98 L108,122 L108,466 Q200,482 292,466 L292,122 L242,98 Q200,126 158,98 Z',
      sleeveL: 'M108,122 L62,138 L28,360 L74,372 L108,236 Z',
      body() { return `${this.torso} ${this.sleeveL} ${mirror(this.sleeveL)}`; },
      under(p) {
        const s = p.sleeve || '#e8e2d0';
        return [
          `<path d="${this.sleeveL}" fill="${s}"/><path d="${mirror(this.sleeveL)}" fill="${s}"/>`,
        ].join('');
      },
      over(p, b) {
        const t = p.trim || '#ff3d12';
        const s = p.sleeve || '#e8e2d0';
        const out = [
          `<path d="M150,94 Q200,120 250,94 L254,110 Q200,150 146,110Z" fill="${t}"/><path d="M150,94 Q200,120 250,94 L254,110 Q200,150 146,110Z" fill="url(#rib)"/>`,
          `<path d="M108,446 L292,446 L292,466 Q200,482 108,466Z" fill="${t}"/><path d="M108,446 L292,446 L292,466 Q200,482 108,466Z" fill="url(#rib)"/>`,
          `<path d="M30,346 L28,360 L74,372 L76,356Z" fill="${t}"/><path d="${mirror('M30,346 L28,360 L74,372 L76,356Z')}" fill="${t}"/>`,
          `<path d="M108,122 L62,138 L28,360" fill="none" stroke="#000" stroke-opacity=".15" stroke-width="1.2"/>`,
          `<path d="M108,122 Q104,180 108,236" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1.4"/><path d="${mirror('M108,122 Q104,180 108,236')}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1.4"/>`,
        ];
        if (!b) {
          out.push(`<path d="M200,128 L200,448" stroke="#000" stroke-opacity=".35" stroke-width="1.6"/>`);
          [168, 218, 268, 318, 368, 418].forEach((y) => {
            out.push(`<circle cx="200" cy="${y}" r="7" fill="${s}" stroke="#000" stroke-opacity=".3" stroke-width="1"/><circle cx="198" cy="${y - 2}" r="2.2" fill="#fff" opacity=".5"/>`);
          });
          out.push(
            `<path d="M130,330 L168,372" stroke="#000" stroke-opacity=".5" stroke-width="3.4" stroke-linecap="round"/><path d="M270,330 L232,372" stroke="#000" stroke-opacity=".5" stroke-width="3.4" stroke-linecap="round"/>`,
          );
        } else {
          out.push(`<path d="M200,128 Q198,300 200,448" stroke="#000" stroke-opacity=".15" stroke-width="1.2"/>`);
        }
        return out.join('');
      },
      folds: ['M130,140 Q124,300 134,460', 'M270,140 Q276,300 266,460', 'M60,160 Q50,260 40,350', 'M340,160 Q350,260 360,350'],
    },
  };

  const text = (t, o = {}) => {
    const { x = 200, y = 300, s = 28, fill = '#111', ls = 0, anchor = 'middle', rot = 0, font = 'black', op = 1, distress = true, skew = 0 } = o;
    const tf = rot || skew ? ` transform="rotate(${rot} ${x} ${y})${skew ? ` skewX(${skew})` : ''}"` : '';
    return `<g${distress ? ' filter="url(#distress)"' : ''} opacity="${op}"><text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font === 'black' ? FONT_BLACK : FONT_REG}" font-weight="${font === 'black' ? 400 : 600}" font-size="${s}" letter-spacing="${ls}" fill="${fill}"${tf}>${t}</text></g>`;
  };

  function prints(p, face) {
    const list = (p.print && p.print[face]) || [];
    return list.map((it) => {
      if (it.k === 'raw') return `<g${it.distress === false ? '' : ' filter="url(#distress)"'}>${it.svg}</g>`;
      return text(it.t, it);
    }).join('');
  }

  function hanger(type) {
    if (type === 'hoodie' || type === 'varsity') {
      return `<g><path d="M200,22 L200,66" stroke="#1b1b19" stroke-width="5" stroke-linecap="round"/>${hook()}</g>`;
    }
    const wide = type === 'tank' ? [96, 116] : [66, 130];
    return `<g>
      <path d="M${wide[0]},${wide[1] + 4} L200,74 L${400 - wide[0]},${wide[1] + 4}" fill="none" stroke="#161614" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M${wide[0] + 6},${wide[1] + 1.5} L200,71 L${400 - wide[0] - 6},${wide[1] + 1.5}" fill="none" stroke="#6d6d68" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>
      <rect x="196" y="54" width="8" height="26" rx="3" fill="#161614"/>
      ${hook()}
    </g>`;
  }

  function hook() {
    return `<path d="M200,58 L200,16 Q200,8 208,8" fill="none" stroke="#2b2b29" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M200,58 L200,16 Q200,8 208,8" fill="none" stroke="#d8d9d4" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  function folds(spec) {
    return spec.folds.map((d) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="14" filter="url(#soft)"/>
      <path d="${d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+x + 9},${y}`)}" fill="none" stroke="#000" stroke-opacity=".13" stroke-width="10" filter="url(#soft)"/>`).join('');
  }

  /* Peças com foto real: a imagem recortada (PNG/WebP com alfa) pendura num cabide, grampo ou no próprio cabide da foto. */
  function photoLayout(ph) {
    const top = ph.hang === 'own' ? 52 : ph.hang === 'clip' ? 92 : 90;
    const s = Math.min(330 / ph.w, (492 - top) / ph.h);
    const w = ph.w * s, h = ph.h * s;
    return { top, x: 200 - w / 2, w, h, bottom: top + h };
  }

  function photoHanger(ph, L) {
    if (ph.hang === 'own') {
      return `<g>${hookPath(L.top + 14)}</g>`;
    }
    if (ph.hang === 'clip') {
      return `<g><path d="M150,${L.top - 2} H250" stroke="#161614" stroke-width="6" stroke-linecap="round"/>${hookPath(L.top - 2)}</g>`;
    }
    return hanger('tee');
  }

  function hookPath(to) {
    const d = `M200,${to} L200,16 Q200,8 208,8`;
    return `<path d="${d}" fill="none" stroke="#2b2b29" stroke-width="3.2" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#d8d9d4" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  function buildPhoto(p, face, opt) {
    const ph = p.photo, L = photoLayout(ph);
    const flip = face === 'back' ? ` transform="translate(400 0) scale(-1 1)"` : '';
    const img = (style) => `<image href="${ph.src}" x="${L.x}" y="${L.top}" width="${L.w}" height="${L.h}" preserveAspectRatio="xMidYMid meet"${style}/>`;
    if (opt.slice) {
      return `<svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g style="filter:brightness(.42)">${img('')}</g></svg>`;
    }
    return `<svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${p.name}">
      ${photoHanger(ph, L)}
      <g${flip}>${img('')}</g>
    </svg>`;
  }

  const hem = (p) => (p.photo ? photoLayout(p.photo).bottom : SPECS[p.type].hem);

  function build(p, face, opt = {}) {
    if (p.photo) return buildPhoto(p, face, opt);
    const spec = SPECS[p.type];
    const back = face === 'back';
    const id = `g${++uid}`;
    const body = spec.body(back);

    if (opt.slice) {
      return `<svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${body}" fill="${p.color}"/><path d="${body}" fill="#000" opacity=".34"/></svg>`;
    }

    const clip = `<clipPath id="${id}"><path d="${body}"/></clipPath>`;
    const base = `<path d="${body}" fill="${p.color}"/>`;
    const shade = `
      <path d="${body}" fill="url(#drape)"/>
      <rect width="400" height="520" fill="url(#sheen)"/>
      ${folds(spec)}
      <rect width="400" height="520" fill="#000" opacity=".34" filter="url(#weave)"/>`;

    return `<svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${p.name} — ${back ? 'costas' : 'frente'}">
      <defs>${clip}</defs>
      ${hanger(p.type)}
      <g>${spec.behind ? spec.behind(p, back) : ''}</g>
      <g clip-path="url(#${id})">
        ${base}
        ${spec.under(p, back)}
        ${prints(p, face)}
        ${shade}
        ${spec.over(p, back)}
      </g>
    </svg>`;
  }

  window.Garments = { build, SPECS, hem };
})();
