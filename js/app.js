(() => {
  const V = window.VELCHRO;
  const P = V.products;
  const N = P.length;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const RAD = Math.PI / 180;

  const html = document.documentElement;
  const body = document.body;
  const hero = $('#hero');
  const stage = $('#stage');
  const rail = $('#rail');
  const itemsEl = $('#items');
  const focusEl = $('#focus');
  const infoEl = $('#info');
  const arcG = $('#arcG');
  const copy = $('#copy');
  const rangeEl = $('#range');
  const eyeSuffix = $('#eyeSuffix');

  const HOOK = 0.055; // pivô do gancho em fração de --iw (22 / 400)

  let W = 0, H = 0, iw = 0, fiw = 0;
  let R = 0, cx = 0, cy = 0, stepDeg = 12, VIS = 10, narrow = false, chord = 1;
  let cMin = 0, cMax = 0, railFocus = 0;

  /* ---------- montagem das peças ---------- */
  focusEl.hidden = false;
  const items = P.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'item';
    const steps = p.photo ? [-3, -1.5, 0, 1.5, 3] : [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    const slices = steps.map((k) => `<div class="slice" style="transform:translateZ(calc(var(--iw)*${k * (p.photo ? 0.0083 : 0.00625)}))">${Garments.build(p, 'front', { slice: true })}</div>`).join('');
    el.innerHTML = `
      <div class="cast"></div>
      <div class="pivot"><div class="sway"><div class="turn">
        ${slices}
        <div class="face front">${Garments.build(p, 'front')}
          <div class="tagwrap"><i class="string"></i><div class="tag" style="--bg:${p.tag.bg};--fg:${p.tag.fg}">${brl(p.price)} · ${p.name.split(' ').slice(-1)[0]}</div></div>
        </div>
        <div class="face back">${Garments.build(p, 'back')}</div>
      </div></div></div>`;
    itemsEl.appendChild(el);
    return {
      i, p, el,
      cast: $('.cast', el), pivot: $('.pivot', el), sway: $('.sway', el), turn: $('.turn', el),
      x: 0, y: 0, vx: 0, vy: 0, sc: 1, vsc: 0, tn: 90, vtn: 0, sw: 0, vsw: 0, op: 0, born: false, init: false, th: 0,
    };
  });

  $('#srList').innerHTML = P.map((p, i) => `<li><button type="button" data-i="${i}">${p.name} — ${brl(p.price)}</button></li>`).join('');
  $('#ticker').innerHTML = V.ticker.map((t) => `<span>${t}</span>`).join('').repeat(8);
  $('#band').innerHTML = Array(2).fill(['Velchro', 'Feito pra quem fica', 'Velchro', 'Escolha com a mão'].map((t) => `<span>${t}</span>`).join('')).join('');

  /* ---------- estado ---------- */
  let c = 0, cV = 0, cTarget = 0;
  let hover = -1;
  let focus = -1;
  let face = 'front';
  let faceTurnTarget = 0;
  let size = null;
  let drag = null;
  let lastC = 0, rackVel = 0;
  let manualTurn = null;
  let snapTimer = 0;
  const pm = { x: 0, y: 0, tx: 0, ty: 0 };
  let fb = 1; // 1 = arco ativo, 0 = foco

  const snapTo = (v) => clamp(Math.round(v - cMin) + cMin, cMin, cMax);

  /* ---------- layout em meia-lua ---------- */
  function layout() {
    W = hero.clientWidth; H = hero.clientHeight;
    narrow = W < 760;
    VIS = narrow ? 5 : 10;
    stepDeg = 120 / VIS;
    iw = Math.min(0.3 * H, (narrow ? 0.44 : 0.19) * W);
    R = narrow ? W * 0.62 : Math.min(W * 0.58, H * 1.0);
    const arcTop = H * (narrow ? 0.2 : 0.2);
    cx = W / 2; cy = arcTop + R;
    chord = R * stepDeg * RAD;
    cMin = (VIS - 1) / 2;
    cMax = Math.max(cMin, N - 1 - (VIS - 1) / 2);

    const footer = Math.max(H * 0.043, 32);
    railFocus = Math.max(H * 0.095, 70);
    const fit = (H - railFocus - footer - 24 - 214 - 30) / 1.17;
    fiw = Math.max(180, Math.min(0.45 * H, 0.7 * W, fit));

    const rod = Math.max(8, iw * 0.034);
    html.style.setProperty('--iw', iw + 'px');
    html.style.setProperty('--rod', rod + 'px');
    rail.style.top = railFocus + 'px';
    buildArc(rod);

    cTarget = clamp(cTarget, cMin, cMax);
    c = clamp(c, cMin - 1, cMax + 1);
    placeInfo();
    sizeDust();
  }

  const arcPt = (deg) => [cx + R * Math.sin(deg * RAD), cy - R * Math.cos(deg * RAD)];

  function buildArc(rod) {
    const [x0, y0] = arcPt(-80);
    const [x1, y1] = arcPt(80);
    const d = `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}`;
    const wires = [-34, -17, 17, 34].map((deg) => {
      const [x, y] = arcPt(deg);
      return `<line x1="${x}" y1="${y}" x2="${x}" y2="-40" stroke="#2b2b29" stroke-opacity=".55" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="${rod * 0.75}" fill="#c9cac5" stroke="#5f605c" stroke-width="1"/>`;
    }).join('');
    arcG.innerHTML = `${wires}
      <path d="${d}" fill="none" stroke="rgba(20,20,18,.28)" stroke-width="${rod + 4}" stroke-linecap="round" transform="translate(0 ${rod * 1.1})" filter="url(#soft)"/>
      <path d="${d}" fill="none" stroke="#6f706c" stroke-width="${rod}" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#cdcec9" stroke-width="${rod * 0.68}" stroke-linecap="round" transform="translate(0 ${-rod * 0.08})"/>
      <path d="${d}" fill="none" stroke="#fbfbf8" stroke-width="${rod * 0.24}" stroke-linecap="round" transform="translate(0 ${-rod * 0.22})"/>`;
  }

  function placeInfo() {
    const hemY = Garments.hem(P[Math.max(focus, 0)]) / 400;
    infoEl.style.top = railFocus + (hemY - HOOK) * fiw + 22 + 'px';
    const mid = railFocus + fiw * 0.62;
    $('#prev').style.top = mid + 'px';
    $('#next').style.top = mid + 'px';
  }

  /* ---------- física (molas) ---------- */
  const spring = (pos, vel, target, k, damp, dt) => {
    vel += (k * (target - pos) - damp * vel) * dt;
    return [pos + vel * dt, vel];
  };

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    const inFocus = focus >= 0;

    // giro do cabideiro
    [c, cV] = spring(c, cV, cTarget, drag ? 320 : 85, drag ? 36 : 17, dt);
    const vel = ((c - lastC) * chord) / Math.max(dt, 0.001);
    lastC = c;
    rackVel += (vel - rackVel) * Math.min(1, dt * 8);

    pm.x += (pm.tx - pm.x) * Math.min(1, dt * 4);
    pm.y += (pm.ty - pm.y) * Math.min(1, dt * 4);
    fb += ((inFocus ? 0 : 1) - fb) * Math.min(1, dt * 6);
    const ox = pm.x * 16 * fb, oy = pm.y * 8 * fb;
    arcG.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
    hero.style.setProperty('--lx', (50 + pm.x * 24).toFixed(1) + '%');
    hero.style.setProperty('--ly', (14 + pm.y * 10).toFixed(1) + '%');

    const first = Math.round(c - (VIS - 1) / 2) + 1;
    const txt = hover >= 0 && !inFocus
      ? `${P[hover].name} — ${brl(P[hover].price)}`
      : `${String(first).padStart(2, '0')}–${String(Math.min(first + VIS - 1, N)).padStart(2, '0')} / ${N}`;
    if (rangeEl.textContent !== txt) rangeEl.textContent = txt;
    eyeSuffix.style.display = hover >= 0 && !inFocus ? 'none' : '';

    for (const it of items) {
      const i = it.i;
      const sel = inFocus && i === focus;
      let th = (i - c) * stepDeg;
      if (!inFocus && hover >= 0 && i !== hover) {
        const d = i - hover;
        th += Math.sign(d) * 3.4 * Math.max(0, 1 - (Math.abs(d) - 1) * 0.45);
      }
      const ath = Math.abs(th);
      let tx = cx + R * Math.sin(th * RAD) + ox;
      let ty = cy - R * Math.cos(th * RAD) + oy;
      let ts = 1 - 0.3 * Math.min(1, ath / 66) ** 1.4;
      let tt = 78 * Math.tanh(th / 20);
      let to = clamp((67 - ath) / 10, 0, 1);
      let wobble = reduce ? 0 : Math.sin(t * 0.9 + i * 1.7) * 0.7 + Math.sin(t * 0.37 + i) * 0.4;

      if (!inFocus && i === hover) { tt *= 0.22; ts *= 1.07; }

      if (inFocus) {
        if (sel) { tx = W / 2; ty = railFocus; ts = fiw / iw; tt = manualTurn ?? faceTurnTarget; wobble *= 0.4; to = 1; }
        else { to = 0; tx += (th < 0 ? -1 : 1) * 40; }
      }

      // chegada: as peças caem no arco, uma a uma, com balanço
      if (!it.born) {
        if (now > 350 + Math.abs(i - (N - 1) / 2) * 38) {
          it.born = true;
          it.vsw = reduce ? 0 : (i % 2 ? 190 : -170);
          it.vtn = reduce ? 0 : -120;
        } else { to = 0; }
      }
      if (!it.init) { it.init = true; it.x = tx; it.y = ty - H * 0.55; it.tn = tt + 40; }

      [it.x, it.vx] = spring(it.x, it.vx, tx, sel ? 130 : 240, sel ? 18 : 26, dt);
      [it.y, it.vy] = spring(it.y, it.vy, ty, sel ? 130 : 200, sel ? 18 : 24, dt);
      [it.sc, it.vsc] = spring(it.sc, it.vsc, ts, 130, 19, dt);
      [it.tn, it.vtn] = sel && manualTurn !== null ? [tt, 0] : spring(it.tn, it.vtn, tt, sel ? 110 : 80, sel ? 14 : 12, dt);
      const swayTarget = clamp(-rackVel * 0.0042, -16, 16) * (sel ? 0.4 : 1) + wobble;
      [it.sw, it.vsw] = spring(it.sw, it.vsw, swayTarget, 38 + (i % 3) * 5, 2.7 + (i % 2) * 0.5, dt);
      it.op += (to - it.op) * Math.min(1, dt * (to > it.op ? 8 : 12));
      it.th = th;

      it.pivot.style.transform = `translate3d(${(it.x - iw / 2).toFixed(2)}px,${(it.y - HOOK * iw).toFixed(2)}px,0) scale(${it.sc.toFixed(4)})`;
      it.pivot.style.opacity = it.op.toFixed(3);
      it.sway.style.transform = `rotate(${it.sw.toFixed(3)}deg)`;
      it.turn.style.transform = `rotateY(${it.tn.toFixed(2)}deg)`;
      const flat = Math.abs(Math.sin(it.tn * RAD)) < 0.04;
      if (flat !== it.flat) { it.flat = flat; it.turn.classList.toggle('flat', flat); }

      // sombra projetada na parede
      const spread = Math.abs(Math.cos(it.tn * RAD));
      const cw = iw * (0.2 + 0.62 * spread) * it.sc;
      it.cast.style.width = cw + 'px';
      it.cast.style.height = iw * 1.05 * it.sc + 'px';
      it.cast.style.opacity = (0.1 * it.op).toFixed(3);
      it.cast.style.transform = `translate3d(${(it.x - cw / 2 + iw * 0.07 * it.sc - it.sw * 1.2).toFixed(1)}px,${(it.y + iw * 0.12 * it.sc).toFixed(1)}px,0)`;

      if (sel !== it.isSel) { it.isSel = sel; it.el.classList.toggle('sel', sel); }
      it.el.style.zIndex = sel ? 80 : i === hover ? 60 : Math.round(40 - (ath / stepDeg) * 3);
    }

    requestAnimationFrame(frame);
  }

  /* ---------- ponteiro ---------- */
  const loc = (e) => {
    const r = hero.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function pick(px, py) {
    if (focus >= 0) return -1;
    let best = -1, bz = -Infinity;
    for (const it of items) {
      if (it.op < 0.3) continue;
      const s = it.sc;
      const half = iw * s * (0.46 * Math.abs(Math.cos(it.tn * RAD)) + 0.1);
      if (Math.abs(px - it.x) > half) continue;
      if (py < it.y - 12 || py > it.y + iw * 1.22 * s) continue;
      const z = -Math.abs(it.th) + (it.i === hover ? 5 : 0);
      if (z > bz) { bz = z; best = it.i; }
    }
    return best;
  }

  function setHover(i) {
    if (i === hover) return;
    hover = i;
    stage.classList.toggle('pointing', i >= 0);
  }

  hero.addEventListener('pointermove', (e) => {
    const [x, y] = loc(e);
    pm.tx = x / W - 0.5; pm.ty = y / H - 0.5;
  });
  hero.addEventListener('pointerleave', () => { pm.tx = pm.ty = 0; });

  stage.addEventListener('pointermove', (e) => {
    if (drag || e.pointerType !== 'mouse') return;
    const [x, y] = loc(e);
    setHover(pick(x, y));
  });
  stage.addEventListener('pointerleave', () => { if (!drag) setHover(-1); });

  stage.addEventListener('pointerdown', (e) => {
    const [x, y] = loc(e);
    stage.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, c0: c, moved: false, pick: pick(x, y), id: e.pointerId, lx: e.clientX, lt: e.timeStamp, v: 0, turn0: focus >= 0 ? items[focus].tn : 0 };
    if (focus >= 0) manualTurn = items[focus].tn;
    if (e.pointerType !== 'mouse') setHover(drag.pick);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; stage.classList.add('dragging'); setHover(-1); }
    if (!drag.moved) return;
    const dtm = Math.max(1, e.timeStamp - drag.lt);
    drag.v = (e.clientX - drag.lx) / dtm;
    drag.lx = e.clientX; drag.lt = e.timeStamp;
    if (focus >= 0) {
      manualTurn = drag.turn0 + dx * 0.55;
    } else {
      let target = drag.c0 - dx / chord;
      if (target > cMax) target = cMax + (target - cMax) * 0.3;
      if (target < cMin) target = cMin + (target - cMin) * 0.3;
      cTarget = target;
    }
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    stage.classList.remove('dragging');
    if (focus >= 0) {
      if (d.moved) {
        let n = Math.round((items[focus].tn + d.v * 160) / 180);
        if (P[focus].photo) n = Math.round(n / 2) * 2; // fotos não têm costas
        face = Math.abs(n) % 2 ? 'back' : 'front';
        faceTurnTarget = n * 180;
        manualTurn = null;
        syncSeg();
      }
      return;
    }
    if (d.moved) cTarget = snapTo(cTarget - (d.v * 260) / chord);
    else if (d.pick >= 0) open(d.pick);
    if (e.pointerType === 'mouse') { const [x, y] = loc(e); setHover(pick(x, y)); } else setHover(-1);
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // a roda só move o cabideiro quando o mouse está sobre ele; nas pontas e no resto da página, rola a página
  hero.addEventListener('wheel', (e) => {
    if (focus >= 0 || e.ctrlKey) return;
    const [x, y] = loc(e);
    if (y < 0 || (y > H * 0.64 && pick(x, y) < 0)) return;
    const dy = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if ((dy > 0 && cTarget >= cMax - 0.01) || (dy < 0 && cTarget <= cMin + 0.01)) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : 1;
    cTarget = clamp(cTarget + (dy * unit) / 120, cMin, cMax);
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { cTarget = snapTo(cTarget); }, 140);
  }, { passive: false });

  /* ---------- foco ---------- */
  const lock = (on) => html.classList.toggle('locked', on);

  function open(i) {
    if (window.scrollY > 2) window.scrollTo({ top: 0, behavior: 'instant' });
    lock(true);
    focus = i;
    size = null;
    setHover(-1);
    face = 'front';
    faceTurnTarget = 0; manualTurn = null;
    cTarget = snapTo(i);
    body.classList.add('is-focus');
    $('#navClose').tabIndex = 0;
    fill();
    placeInfo();
    infoEl.style.opacity = 0;
    setTimeout(() => { infoEl.style.opacity = 1; }, reduce ? 0 : 380);
    history.replaceState(null, '', '#' + P[i].id);
  }

  const wrapTurn = (it) => {
    it.tn = ((it.tn % 360) + 360) % 360;
    if (it.tn > 180) it.tn -= 360;
  };

  function close() {
    if (focus < 0) return;
    wrapTurn(items[focus]);
    focus = -1;
    faceTurnTarget = 0; manualTurn = null;
    body.classList.remove('is-focus');
    $('#navClose').tabIndex = -1;
    infoEl.style.opacity = 0;
    lock(false);
    history.replaceState(null, '', location.pathname);
  }

  function go(dir) {
    if (focus < 0) return;
    const next = (focus + dir + N) % N;
    wrapTurn(items[focus]);
    focus = next;
    size = null;
    face = 'front';
    faceTurnTarget = 0; manualTurn = null;
    cTarget = snapTo(next);
    items[next].vsw = dir * 120;
    fill();
    placeInfo();
    history.replaceState(null, '', '#' + P[next].id);
  }

  function fill() {
    const p = P[focus];
    $('#infoName').textContent = p.name;
    $('#seg').style.display = p.photo ? 'none' : '';
    $('#infoPrice').innerHTML = `<b>${brl(p.price)}</b> · em até 3x sem juros`;
    $('#sizes').innerHTML = V.sizes.map((s) => `<button type="button" data-size="${s}" aria-pressed="false">${s}</button>`).join('');
    syncSeg();
    syncCta();
  }

  function syncSeg() {
    $('#seg').classList.toggle('back', face === 'back');
    $$('#seg button').forEach((b) => b.classList.toggle('lit', b.dataset.face === face));
  }
  function syncCta() {
    const el = $('#cta');
    el.textContent = size ? `Adicionar à sacola · ${size}` : 'Escolha um tamanho';
    el.classList.toggle('ready', !!size);
  }

  $('#seg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    face = b.dataset.face;
    const base = Math.round(items[focus].tn / 360) * 360;
    faceTurnTarget = base + (face === 'back' ? 180 : 0);
    syncSeg();
  });
  $('#sizes').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    size = b.dataset.size;
    $$('#sizes button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    syncCta();
  });
  $('#cta').addEventListener('click', () => {
    if (!size) {
      const s = $('#sizes');
      s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
      return;
    }
    addToBag(P[focus].id, size);
    toast(`${P[focus].name} (${size}) na sacola`);
  });
  $('#prev').addEventListener('click', () => go(-1));
  $('#next').addEventListener('click', () => go(1));
  $('#navClose').addEventListener('click', close);
  $('#srList').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) open(+b.dataset.i);
  });
  $('#srList').addEventListener('focusin', (e) => {
    const b = e.target.closest('button');
    if (b && focus < 0) { setHover(+b.dataset.i); cTarget = snapTo(+b.dataset.i); }
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#sheet').classList.contains('on')) return sheet(null);
      if ($('#drawer').classList.contains('on')) return bagToggle(false);
      return close();
    }
    if (focus >= 0) {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    } else if (!e.target.closest('button, a') && window.scrollY < H * 0.5) {
      if (e.key === 'ArrowLeft') cTarget = snapTo(cTarget - 1);
      if (e.key === 'ArrowRight') cTarget = snapTo(cTarget + 1);
    }
  });

  /* ---------- sacola ---------- */
  let bag = [];
  try { bag = JSON.parse(localStorage.getItem('velchro-bag') || '[]').filter((l) => P.some((p) => p.id === l.id)); } catch (_) { bag = []; }

  function saveBag() { try { localStorage.setItem('velchro-bag', JSON.stringify(bag)); } catch (_) { /* modo privado */ } }
  function addToBag(id, sz) {
    const line = bag.find((l) => l.id === id && l.size === sz);
    if (line) line.qty += 1; else bag.push({ id, size: sz, qty: 1 });
    saveBag(); renderBag();
  }
  function renderBag() {
    const count = bag.reduce((n, l) => n + l.qty, 0);
    $('#bagCount').textContent = `(${count})`;
    const total = bag.reduce((n, l) => n + l.qty * P.find((p) => p.id === l.id).price, 0);
    $('#bagTotal').textContent = brl(total);
    $('#checkout').disabled = !count;
    $('#bagList').innerHTML = bag.map((l, k) => {
      const p = P.find((x) => x.id === l.id);
      return `<li>
        <div class="bag-thumb">${Garments.build(p, 'front')}</div>
        <div><div class="bag-name">${p.name}</div><div class="bag-meta">Tamanho ${l.size}</div>
          <div class="qty"><button type="button" data-k="${k}" data-d="-1" aria-label="Menos">−</button><span>${l.qty}</span><button type="button" data-k="${k}" data-d="1" aria-label="Mais">+</button></div></div>
        <div class="bag-price">${brl(p.price * l.qty)}</div></li>`;
    }).join('');
  }
  $('#bagList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    const l = bag[+b.dataset.k];
    l.qty += +b.dataset.d;
    if (l.qty <= 0) bag.splice(+b.dataset.k, 1);
    saveBag(); renderBag();
  });
  function bagToggle(on) {
    $('#drawer').classList.toggle('on', on);
    $('#scrim').classList.toggle('on', on);
    $('#drawer').setAttribute('aria-hidden', String(!on));
  }
  $('#navBag').addEventListener('click', () => bagToggle(true));
  $('#drawerClose').addEventListener('click', () => bagToggle(false));
  $('#scrim').addEventListener('click', () => { bagToggle(false); });
  $('#checkout').addEventListener('click', () => {
    const lines = bag.map((l) => { const p = P.find((x) => x.id === l.id); return `• ${l.qty}x ${p.name} (${l.size}) — ${brl(p.price * l.qty)}`; });
    const total = bag.reduce((n, l) => n + l.qty * P.find((p) => p.id === l.id).price, 0);
    const msg = `Olá! Quero finalizar meu pedido na Velchro:\n\n${lines.join('\n')}\n\nTotal: ${brl(total)}`;
    window.open(`https://wa.me/${V.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- sobre / contato / créditos ---------- */
  const SHEETS = {
    sobre: `<h2>Sobre</h2>
      <p>A Velchro nasceu de uma ideia simples: roupa boa se escolhe com a mão, no cabide, olhando de perto. Aqui o site é a loja — o cabideiro é o mesmo, só que cabe no seu bolso.</p>
      <p>Cada peça sai em tiragem curta. Quando acaba, acaba.</p>
      <p>Dúvidas? Fale com a gente em <a href="mailto:contato@velchro.com">contato@velchro.com</a>.</p>
      <p><a href="#creditos" data-open="creditos">Créditos das fotos</a></p>`,
    contato: `<h2>Contato</h2>
      <p>Pedidos, trocas e parcerias:</p>
      <p><a href="https://instagram.com/" target="_blank" rel="noopener">@velchro</a><br><a href="mailto:contato@velchro.com">contato@velchro.com</a></p>
      <p>Atendimento de segunda a sábado, das 10h às 19h.</p>`,
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function creditsHtml() {
    const rows = P.filter((p) => p.credit).map((p) => `<li><b>${esc(p.name)}</b> — ${esc(p.credit.author || 'autor não informado')} · ${esc(p.credit.lic)} · <a href="${esc(p.credit.page)}" target="_blank" rel="noopener">fonte</a></li>`);
    return `<h2>Créditos</h2><p>Fotos de domínio público ou sob licenças livres, via Wikimedia Commons, recortadas para o cabideiro.</p><ul class="credits">${rows.join('')}</ul>`;
  }
  function sheet(name) {
    const el = $('#sheet');
    if (name) $('#sheetBody').innerHTML = name === 'creditos' ? creditsHtml() : SHEETS[name];
    el.classList.toggle('on', !!name);
    el.setAttribute('aria-hidden', String(!name));
    if (focus < 0) lock(!!name);
  }
  $$('[data-sheet]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); sheet(a.dataset.sheet); }));
  $('#sheetClose').addEventListener('click', () => sheet(null));
  $('#sheetBody').addEventListener('click', (e) => {
    const l = e.target.closest('[data-open]');
    if (l) { e.preventDefault(); sheet(l.dataset.open); }
  });

  /* ---------- página: parallax, revelar e texto que acende ---------- */
  const scrub = $('#scrub');
  const words = scrub.textContent.trim().split(/\s+/);
  scrub.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  const wordEls = $$('.w', scrub);

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { threshold: 0.18 });
  $$('.reveal').forEach((el, k) => {
    el.style.setProperty('--d', (k % 3) * 110);
    io.observe(el);
  });

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const sy = window.scrollY;
      if (sy < H * 1.2) {
        stage.style.transform = `translate3d(0,${(sy * 0.22).toFixed(1)}px,0)`;
        copy.style.transform = `translate3d(0,${(sy * 0.42).toFixed(1)}px,0)`;
        copy.style.setProperty('--co', clamp(1 - sy / (H * 0.55), 0, 1).toFixed(3));
      }
      const r = scrub.getBoundingClientRect();
      const p = clamp((innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.25), 0, 1);
      const lit = Math.round(p * wordEls.length);
      wordEls.forEach((w, k) => w.classList.toggle('lit', k < lit));
    });
  }
  addEventListener('scroll', onScroll, { passive: true });

  /* ---------- poeira na luz ---------- */
  const cv = $('#dust');
  const ctx = cv.getContext('2d');
  const motes = Array.from({ length: 48 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, s: 0.004 + Math.random() * 0.012, p: Math.random() * 6.28 }));
  function sizeDust() {
    const d = Math.min(2, devicePixelRatio || 1);
    cv.width = W * d; cv.height = H * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function drawDust(now) {
    if (!reduce && window.scrollY < H) {
      ctx.clearRect(0, 0, W, H);
      const lx = (50 + pm.x * 24) / 100 * W, ly = (14 + pm.y * 10) / 100 * H;
      for (const m of motes) {
        m.y += m.s * 0.016; m.x += Math.sin(now / 2400 + m.p) * 0.0004;
        if (m.y > 1) m.y = -0.02;
        const px = m.x * W, py = m.y * H;
        const d = Math.hypot((px - lx) / (W * 0.5), (py - ly) / (H * 0.7));
        const a = clamp(1 - d, 0, 1) * (0.35 + 0.35 * Math.sin(now / 900 + m.p)) * 0.5;
        if (a < 0.01) continue;
        ctx.fillStyle = `rgba(70,58,34,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(px, py, m.r, 0, 6.283); ctx.fill();
      }
    }
    requestAnimationFrame(drawDust);
  }

  /* ---------- início ---------- */
  addEventListener('resize', layout);
  layout();
  c = cTarget = cMin; // começa com as 10 primeiras peças à vista
  renderBag();
  window.scrollTo(0, 0);
  setTimeout(() => copy.classList.add('in'), reduce ? 0 : 500);
  const start = P.findIndex((p) => '#' + p.id === location.hash);
  if (start >= 0) {
    items.forEach((it) => { it.born = true; });
    open(start);
  }
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); requestAnimationFrame(drawDust); });
  onScroll();

  window.__velchro = { open, close, go, items, get focus() { return focus; }, get c() { return c; } };
})();
